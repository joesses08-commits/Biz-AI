import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/get-user";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all factories
  const { data: factories } = await supabaseAdmin
    .from("factory_catalog")
    .select("id, name, email, max_samples")
    .eq("user_id", user.id)
    .order("name");

  // Get all factory tracks that have sample_requested but not sample_shipped/arrived
  const { data: tracks } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("id, factory_id, product_id, status, priority_order, factory_catalog(id, name), plm_products(id, name, sku, images, status, killed), plm_track_stages(stage, status, revision_number)")
    .eq("user_id", user.id)
    .not("status", "eq", "killed")
    .not("status", "eq", "approved");

  // Filter to only tracks where sample was requested but not yet shipped
  const filteredTracks = (tracks || []).filter((t: any) => {
    const stages = t.plm_track_stages || [];
    const hasSampleRequested = stages.some((s: any) => s.stage === "sample_requested" && s.status === "done");
    const hasSampleShipped = stages.some((s: any) => s.stage === "sample_shipped" && s.status === "done");
    const productOk = !t.plm_products?.killed && t.plm_products?.status !== "hold";
    return hasSampleRequested && !hasSampleShipped && productOk;
  });

  // Map to expected shape
  const samples = filteredTracks.map((t: any) => ({
    id: t.id,
    factory_id: t.factory_id,
    product_id: t.product_id,
    priority_order: t.priority_order,
    current_stage: "sample_requested",
    status: "requested",
    plm_products: t.plm_products,
    factory_catalog: t.factory_catalog,
  })).sort((a: any, b: any) => (a.priority_order ?? 99999) - (b.priority_order ?? 99999));

  return NextResponse.json({ factories: factories || [], samples });
}

export async function POST(req: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "save_priorities") {
    const { factory_id, ordered_ids } = body;
    for (let i = 0; i < ordered_ids.length; i++) {
      await supabaseAdmin.from("plm_factory_tracks")
        .update({ priority_order: i + 1 })
        .eq("id", ordered_ids[i])
        .eq("user_id", user.id);
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
