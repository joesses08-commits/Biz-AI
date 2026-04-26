import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/get-user";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getPortalUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin.from("factory_portal_users").select("user_id").eq("session_token", token).gt("session_expires_at", new Date().toISOString()).single();
  return data?.user_id || null;
}

export async function GET(req: NextRequest) {
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    userId = await getPortalUserId(req);
  } else {
    const user = await getEffectiveUser();
    userId = user?.id || null;
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  // Run factories and tracks in parallel
  const [{ data: factories }, { data: tracks }] = await Promise.all([
    supabaseAdmin.from("factory_catalog").select("id, name, email, max_samples").eq("user_id", user.id).order("name"),
    supabaseAdmin.from("plm_factory_tracks")
      .select("id, factory_id, product_id, status, priority_order, factory_catalog(id, name), plm_products(id, name, sku, images, status, killed), plm_track_stages(stage, status, revision_number)")
      .eq("user_id", user.id)
      .not("status", "eq", "killed")
      .not("status", "eq", "approved")
      .eq("plm_products.killed", false)
  ]);

  // Filter to only tracks where sample was requested but not yet shipped IN THE LATEST REVISION
  const filteredTracks = (tracks || []).filter((t: any) => {
    const stages = t.plm_track_stages || [];
    const productOk = !t.plm_products?.killed && t.plm_products?.status !== "hold";
    if (!productOk) return false;
    // Find the latest revision number
    const maxRev = stages.reduce((max: number, s: any) => Math.max(max, s.revision_number || 0), 0);
    // Check latest revision cycle
    const latestRevStages = stages.filter((s: any) => (s.revision_number || 0) === maxRev);
    const hasSampleRequested = latestRevStages.some((s: any) => s.stage === "sample_requested" && s.status === "done");
    const hasSampleShipped = latestRevStages.some((s: any) => s.stage === "sample_shipped" && s.status === "done");
    return hasSampleRequested && !hasSampleShipped;
  });

  // Map to expected shape
  const samples = filteredTracks.map((t: any) => {
    const stages = t.plm_track_stages || [];
    const maxRev = stages.reduce((max: number, s: any) => Math.max(max, s.revision_number || 0), 0);
    const latestRevStages = stages.filter((s: any) => (s.revision_number || 0) === maxRev);
    const latestSampleStage = [...latestRevStages].reverse().find((s: any) => 
      ["sample_production","sample_complete","sample_shipped","sample_arrived","sample_requested"].includes(s.stage)
    );
    return {
      id: t.id,
      factory_id: t.factory_id,
      product_id: t.product_id,
      priority_order: t.priority_order,
      current_stage: latestSampleStage?.stage || "sample_requested",
      status: "requested",
      label: maxRev > 0 ? "revision" : "first",
      plm_products: t.plm_products,
      factory_catalog: t.factory_catalog,
    };
  }).sort((a: any, b: any) => (a.priority_order ?? 99999) - (b.priority_order ?? 99999));

  return NextResponse.json({ factories: factories || [], samples });
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    userId = await getPortalUserId(req);
  } else {
    const user = await getEffectiveUser();
    userId = user?.id || null;
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const body = await req.json();
  const { action } = body;

  if (action === "save_priorities") {
    const { factory_id, ordered_ids, changer_name } = body;
    // Get previous priorities before updating
    const { data: prevTracks } = await supabaseAdmin.from("plm_factory_tracks")
      .select("id, priority_order, product_id, factory_catalog(name), plm_products(id, name)")
      .in("id", ordered_ids);
    const prevMap: Record<string, any> = {};
    (prevTracks || []).forEach((t: any) => { prevMap[t.id] = t; });

    // Update all priorities
    for (let i = 0; i < ordered_ids.length; i++) {
      await supabaseAdmin.from("plm_factory_tracks")
        .update({ priority_order: i + 1 })
        .eq("id", ordered_ids[i])
        .eq("user_id", user.id);
    }

    // Log changes to product history
    const loggerName = changer_name || "Admin";
    if (true) {
      for (let i = 0; i < ordered_ids.length; i++) {
        const prev = prevMap[ordered_ids[i]];
        if (!prev) continue;
        const prevPrio = prev.priority_order;
        const newPrio = i + 1;
        if (prevPrio !== newPrio) {
          const factoryName = (prev as any).factory_catalog?.name || "factory";
          const productName = (prev as any).plm_products?.name || "product";
          const note = `Sample priority at ${factoryName}: #${prevPrio ?? "unranked"} → #${newPrio} by ${changer_name}`;
          await supabaseAdmin.from("plm_stages").insert({
            product_id: prev.product_id,
            user_id: user.id,
            stage: "priority_updated",
            notes: note,
            updated_by: loggerName,
            updated_by_role: "designer",
          });
        }
      }
    }
    // Clear priority for tracks not in the list
    const { data: allForFactory } = await supabaseAdmin
      .from("plm_factory_tracks")
      .select("id")
      .eq("factory_id", factory_id)
      .eq("user_id", user.id);
    const unprioritized = (allForFactory || []).filter((t: any) => !ordered_ids.includes(t.id));
    for (const t of unprioritized) {
      await supabaseAdmin.from("plm_factory_tracks").update({ priority_order: null }).eq("id", t.id);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "update_max_samples") {
    const { factory_id, max_samples } = body;
    await supabaseAdmin.from("factory_catalog").update({ max_samples }).eq("id", factory_id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
