import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAMPLE_STAGES = ["sample_production", "sample_complete", "sample_shipped"];
const PRODUCTION_STAGES = ["production_started", "production_complete", "qc_inspection", "ready_to_ship", "shipped"];
const ALL_ALLOWED = [...SAMPLE_STAGES, ...PRODUCTION_STAGES];

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

  const { product_id, batch_id, stage, notes } = await req.json();

  if (!ALL_ALLOWED.includes(stage)) {
    return NextResponse.json({ error: "Stage not allowed" }, { status: 403 });
  }

  if (SAMPLE_STAGES.includes(stage)) {
    // Sample stage — update product dev stage directly
    const { data: product } = await supabaseAdmin
      .from("plm_products")
      .select("id, user_id")
      .eq("id", product_id)
      .eq("user_id", portalUser.user_id)
      .single();

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await supabaseAdmin.from("plm_products").update({
      current_stage: stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", product_id);

    await supabaseAdmin.from("plm_stages").insert({
      product_id,
      user_id: portalUser.user_id,
      stage,
      notes: notes || "",
      updated_by: portalUser.email,
      updated_by_role: "factory",
    });

  } else {
    // Production stage — update the specific order (batch)
    if (!batch_id) return NextResponse.json({ error: "batch_id required for production stages" }, { status: 400 });

    const { data: batch } = await supabaseAdmin
      .from("plm_batches")
      .select("id, product_id, user_id")
      .eq("id", batch_id)
      .eq("factory_id", portalUser.factory_id)
      .single();

    if (!batch) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    await supabaseAdmin.from("plm_batches").update({
      current_stage: stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", batch_id);

    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id,
      product_id: batch.product_id,
      user_id: batch.user_id,
      stage,
      notes: notes || "",
      updated_by: portalUser.email,
      updated_by_role: "factory",
    });
  }

  return NextResponse.json({ success: true });
}
