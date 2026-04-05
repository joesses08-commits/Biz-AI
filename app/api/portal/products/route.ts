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

  // Only show products that have a batch assigned to this factory
  const { data: batches } = await supabaseAdmin
    .from("plm_batches")
    .select("product_id, current_stage")
    .eq("factory_id", portalUser.factory_id);

  if (!batches || batches.length === 0) return NextResponse.json({ products: [] });

  const productIds = Array.from(new Set(batches.map((b: any) => b.product_id)));

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches!inner(current_stage, factory_id)")
    .in("id", productIds)
    .eq("plm_batches.factory_id", portalUser.factory_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ products: products || [] });
}
