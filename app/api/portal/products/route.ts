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

  // ALL sample requests for this factory (all statuses for full history)
  const { data: sampleRequests } = await supabaseAdmin
    .from("plm_sample_requests")
    .select("product_id, current_stage, status, id, created_at, priority_order")
    .eq("factory_id", portalUser.factory_id)
    .order("priority_order", { ascending: true, nullsFirst: false });

  // Products with production orders for this factory (all statuses for history)
  const { data: batches } = await supabaseAdmin
    .from("plm_batches")
    .select("product_id, current_stage, batch_number, order_quantity, updated_at")
    .eq("factory_id", portalUser.factory_id);

  const sampleProductIds = Array.from(new Set((sampleRequests || []).map((s: any) => s.product_id)));
  const batchProductIds = Array.from(new Set((batches || []).map((b: any) => b.product_id)));
  const allProductIds = Array.from(new Set([...sampleProductIds, ...batchProductIds]));

  if (allProductIds.length === 0) return NextResponse.json({ products: [] });

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(*, plm_batch_stages(*)), plm_sample_requests(*, plm_sample_stages(*))")
    .in("id", allProductIds)
    .order("created_at", { ascending: false });

  // Tag each product with which sections are relevant for this factory
  const tagged = (products || []).map((p: any) => {
    const factorySampleRequests = (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser.factory_id);
    const factoryBatches = (p.plm_batches || []).filter((b: any) => b.factory_id === portalUser.factory_id);
    const activeSample = factorySampleRequests.find((s: any) => s.status !== "killed" && s.status !== "approved");
    const hasAnySample = factorySampleRequests.length > 0;
    const hasAnyBatch = factoryBatches.length > 0;
    const activeSampleReq = factorySampleRequests.find((s: any) => s.status !== "killed" && s.status !== "approved");
    const samplePriority = activeSampleReq ? (sampleRequests || []).find((sr: any) => sr.id === activeSampleReq.id)?.priority_order : null;
    return {
      ...p,
      _has_sample: hasAnySample,
      _has_production: hasAnyBatch,
      _sample_priority: samplePriority,
      _sample_request: activeSample || factorySampleRequests[factorySampleRequests.length - 1],
      _all_sample_requests: factorySampleRequests,
      plm_batches: factoryBatches,
      plm_sample_requests: factorySampleRequests,
    };
  });

  return NextResponse.json({ products: tagged });
}
