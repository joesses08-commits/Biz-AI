import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPortalUser(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("factory_portal_users")
    .select("*")
    .eq("session_token", token)
    .gt("session_expires_at", new Date().toISOString())
    .single();
  return data;
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { action, track_id, message } = body;
  const url = new URL(req.url);
  const productId = url.searchParams.get("id") || body.product_id;
  if (action === "get_messages") {
    const { data } = await supabaseAdmin.from("track_messages")
      .select("*").eq("track_id", track_id).order("created_at", { ascending: true });
    // Mark all admin messages as read by factory
    await supabaseAdmin.from("track_messages")
      .update({ read_by_factory: true })
      .eq("track_id", track_id)
      .eq("sender_role", "admin")
      .eq("read_by_factory", false);
    return NextResponse.json({ messages: data || [] });
  }
  if (action === "send_message") {
    await supabaseAdmin.from("track_messages").insert({
      track_id, product_id: productId, user_id: portalUser.user_id,
      sender_role: "factory", sender_name: portalUser.name || portalUser.email || "Factory", message,
    });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const productId = url.searchParams.get("id");
  if (!productId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: product } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(*, plm_batch_stages(*))")
    .eq("id", productId)
    .eq("user_id", portalUser.user_id)
    .single();

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const factoryBatches = (product.plm_batches || []).filter((b: any) => b.factory_id === portalUser.factory_id);

  // Get factory track with all stages
  const { data: track } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("*, plm_track_stages(*)")
    .eq("product_id", productId)
    .eq("factory_id", portalUser.factory_id)
    .single();

  const isDisqualified = track?.status === "killed" && track?.disqualified_at;
  const disqualifiedAt = track?.disqualified_at ? new Date(track.disqualified_at) : null;

  let fakeRequests: any[] = [];
  if (track) {
    const SAMPLE_STAGE_KEYS = ["sample_production", "sample_complete", "sample_shipped", "sample_arrived", "sample_reviewed"];
    const trackStages = (track.plm_track_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const maxRevision = trackStages.reduce((max: number, s: any) => Math.max(max, s.revision_number || 0), 0);
    const hasSampleRequested = trackStages.some((s: any) => s.stage === "sample_requested");

    if (hasSampleRequested) {
      fakeRequests = Array.from({ length: maxRevision + 1 }, (_, revNum) => {
        const revStages = trackStages.filter((s: any) => (s.revision_number || 0) === revNum);
        const sampleStages = revStages.filter((s: any) => SAMPLE_STAGE_KEYS.includes(s.stage));
        const latestSampleStage = sampleStages[sampleStages.length - 1];
        const latestStage = latestSampleStage || revStages[revStages.length - 1];
        const isApproved = track.status === "approved" && revNum === maxRevision;
        const isKilled = track.status === "killed" && revNum === maxRevision;
        const isRevision = revNum < maxRevision;
        const requestedStage = revStages.find((s: any) => s.stage === "sample_requested");
        return {
          id: track.id + "-rev-" + revNum,
          product_id: productId,
          factory_id: portalUser.factory_id,
          status: isApproved ? "approved" : isKilled ? "killed" : isRevision ? "revision" : "requested",
          current_stage: latestStage?.stage || "sample_requested",
          created_at: requestedStage?.created_at || track.created_at,
          label: revNum === 0 ? "first" : "revision",
          notes: revStages.find((s: any) => s.stage === "revision_requested")?.notes || null,
          plm_sample_stages: sampleStages.map((s: any) => ({
            id: s.id,
            stage: s.stage,
            notes: s.notes,
            created_at: s.updated_at || s.created_at,
            updated_by_role: s.updated_by?.includes("@") ? "admin" : "factory",
          })),
        };
      });
    }
  }

  return NextResponse.json({
    product: {
      ...product,
      plm_batches: factoryBatches,
      plm_sample_requests: fakeRequests,
      track_id: track?.id || null,
      is_disqualified: isDisqualified,
      disqualify_reason: track?.disqualify_reason || null,
    }
  });
}
