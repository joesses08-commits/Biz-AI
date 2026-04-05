import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_STAGES = [
  "production_started", "production_complete", "qc_inspection",
  "shipped", "in_transit", "customs", "delivered"
];

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

  const { product_id, stage, notes } = await req.json();

  if (!ALLOWED_STAGES.includes(stage)) {
    return NextResponse.json({ error: "Stage not allowed" }, { status: 403 });
  }

  // Verify product belongs to this factory
  const { data: product } = await supabaseAdmin
    .from("plm_products")
    .select("id, factory_id")
    .eq("id", product_id)
    .single();

  if (!product || product.factory_id !== portalUser.factory_id) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Update stage
  await supabaseAdmin.from("plm_products").update({
    current_stage: stage,
    stage_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", product_id);

  // Log stage history
  await supabaseAdmin.from("plm_stages").insert({
    product_id,
    user_id: portalUser.user_id,
    stage,
    notes: notes || "",
    updated_by: portalUser.email,
    updated_by_role: "factory",
  });

  return NextResponse.json({ success: true });
}
