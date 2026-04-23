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

export async function GET(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get factory max_samples
  const { data: factoryData } = await supabaseAdmin.from("factory_catalog").select("max_samples").eq("id", portalUser.factory_id).single();
  const maxSamples = factoryData?.max_samples || 50;

  // Get all factory tracks for this factory
  const { data: tracks } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("*, plm_track_stages(*)")
    .eq("factory_id", portalUser.factory_id)
    .order("created_at", { ascending: true });

  if (!tracks || tracks.length === 0) return NextResponse.json({ products: [], max_samples: maxSamples });

  // Get production batches for this factory
  const { data: batches } = await supabaseAdmin
    .from("plm_batches")
    .select("product_id, current_stage, batch_number, order_quantity, updated_at")
    .eq("factory_id", portalUser.factory_id);

  const trackProductIds = tracks.map((t: any) => t.product_id);
  const batchProductIds = (batches || []).map((b: any) => b.product_id);
  const allProductIds = Array.from(new Set([...trackProductIds, ...batchProductIds]));

  if (allProductIds.length === 0) return NextResponse.json({ products: [], max_samples: maxSamples });

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(*, plm_batch_stages(*))")
    .in("id", allProductIds)
    .order("created_at", { ascending: false });

  const SAMPLE_STAGE_KEYS = ["sample_requested", "sample_shipped", "sample_arrived", "sample_reviewed"];

  const tagged = (products || []).map((p: any) => {
    const track = tracks.find((t: any) => t.product_id === p.id);
    const factoryBatches = (p.plm_batches || []).filter((b: any) => b.factory_id === portalUser.factory_id);

    if (!track) return { ...p, _has_sample: false, _has_production: factoryBatches.length > 0, plm_batches: factoryBatches, plm_sample_requests: [] };

    // Only show if sample_requested stage exists
    const hasSampleRequested = (track.plm_track_stages || []).some((s: any) => s.stage === "sample_requested");
    if (!hasSampleRequested) return { ...p, _has_sample: false, _has_production: factoryBatches.length > 0, plm_batches: factoryBatches, plm_sample_requests: [] };

    const trackStages = (track.plm_track_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Get all revision cycles
    const maxRevision = trackStages.reduce((max: number, s: any) => Math.max(max, s.revision_number || 0), 0);
    
    // Build fake sample_requests from revision cycles (one per revision round)
    const fakeRequests = Array.from({ length: maxRevision + 1 }, (_, revNum) => {
      const revStages = trackStages.filter((s: any) => (s.revision_number || 0) === revNum);
      const sampleStages = revStages.filter((s: any) => SAMPLE_STAGE_KEYS.includes(s.stage));
      const latestStage = revStages[revStages.length - 1];
      const isApproved = track.status === "approved" && revNum === maxRevision;
      const isKilled = track.status === "killed" && revNum === maxRevision;
      const isRevision = revNum < maxRevision;
      const requestedStage = revStages.find((s: any) => s.stage === "sample_requested");
      const latestSampleStage = sampleStages[sampleStages.length - 1];
      
      return {
        id: track.id + "-rev-" + revNum,
        product_id: p.id,
        factory_id: portalUser.factory_id,
        status: isApproved ? "approved" : isKilled ? "killed" : isRevision ? "revision" : "requested",
        current_stage: latestSampleStage?.stage || "sample_requested",
        created_at: requestedStage?.created_at || track.created_at,
        priority_order: track.priority_order || null,
        label: revNum === 0 ? "first" : "revision",
        notes: revStages.find((s: any) => s.stage === "revision_requested")?.notes || null,
        plm_sample_stages: sampleStages.map((s: any) => ({
          id: s.id,
          stage: s.stage,
          notes: s.notes,
          created_at: s.created_at,
          updated_by_role: s.updated_by?.includes("@") ? "admin" : "factory",
        })),
      };
    });

    const hasActiveSample = track.status === "active";
    const isApproved = track.status === "approved";
    const isKilled = track.status === "killed";
    const latestTrackStage = trackStages[trackStages.length - 1]?.stage;

    return {
      ...p,
      _has_sample: true,
      _has_production: factoryBatches.length > 0,
      _sample_priority: track.priority_order || null,
      _sample_label: maxRevision > 0 ? "revision" : "first",
      _sample_request: fakeRequests[fakeRequests.length - 1],
      _all_sample_requests: fakeRequests,
      plm_batches: factoryBatches,
      plm_sample_requests: fakeRequests,
      track_id: track.id,
    };
  });

  // Add message counts for each track
  const trackIds = tracks.map((t: any) => t.id);
  let messageCounts: any[] = [];
  if (trackIds.length > 0) {
    const { data: msgs } = await supabaseAdmin.from("track_messages")
      .select("track_id, sender_role, read_by_factory")
      .in("track_id", trackIds);
    messageCounts = msgs || [];
  }

  const taggedWithMessages = tagged.map((p: any) => {
    const track = tracks.find((t: any) => t.product_id === p.id);
    if (!track) return p;
    const trackMsgs = messageCounts.filter((m: any) => m.track_id === track.id);
    const totalMessages = trackMsgs.length;
    const unreadMessages = trackMsgs.filter((m: any) => m.sender_role === "admin" && !m.read_by_factory).length;
    return { ...p, track_id: track.id, _total_messages: totalMessages, _unread_messages: unreadMessages };
  });

  return NextResponse.json({ products: taggedWithMessages, max_samples: maxSamples });
}
