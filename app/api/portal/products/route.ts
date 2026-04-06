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

  // Products with sample requests for this factory
  const { data: sampleRequests } = await supabaseAdmin
    .from("plm_sample_requests")
    .select("product_id, current_stage, status, id")
    .eq("factory_id", portalUser.factory_id)
    .neq("status", "killed")
    .neq("status", "approved");

  // Products with production orders for this factory
  const { data: batches } = await supabaseAdmin
    .from("plm_batches")
    .select("product_id, current_stage")
    .eq("factory_id", portalUser.factory_id);

  const sampleProductIds = Array.from(new Set((sampleRequests || []).map((s: any) => s.product_id)));
  const batchProductIds = Array.from(new Set((batches || []).map((b: any) => b.product_id)));
  const allProductIds = Array.from(new Set([...sampleProductIds, ...batchProductIds]));

  if (allProductIds.length === 0) return NextResponse.json({ products: [] });

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(current_stage, factory_id), plm_sample_requests(id, current_stage, status, factory_id)")
    .in("id", allProductIds)
    .order("created_at", { ascending: false });

  // Tag each product with which sections are relevant for this factory
  const tagged = (products || []).map((p: any) => ({
    ...p,
    _has_sample: sampleProductIds.includes(p.id),
    _has_production: batchProductIds.includes(p.id),
    _sample_request: (sampleRequests || []).find((s: any) => s.product_id === p.id),
    plm_batches: (p.plm_batches || []).filter((b: any) => b.factory_id === portalUser.factory_id),
    plm_sample_requests: (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser.factory_id),
  }));

  return NextResponse.json({ products: tagged });
}
