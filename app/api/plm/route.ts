import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type");

  if (type === "collections") {
    const { data } = await supabaseAdmin
      .from("plm_collections")
      .select("*, plm_products(id, milestones, plm_batches(current_stage))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ collections: data || [] });
  }

  if (type === "products") {
    const collectionId = req.nextUrl.searchParams.get("collection_id");
    let query = supabaseAdmin
      .from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name), plm_batches(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (collectionId) query = query.eq("collection_id", collectionId);
    const { data } = await query;
    return NextResponse.json({ products: data || [] });
  }

  if (type === "product") {
    const id = req.nextUrl.searchParams.get("id");
    const { data } = await supabaseAdmin
      .from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*, plm_batch_stages(*))")
      .eq("id", id)
      .single();
    return NextResponse.json({ product: data });
  }

  const [{ data: collections }, { data: products }] = await Promise.all([
    supabaseAdmin.from("plm_collections").select("*, plm_products(id, milestones, plm_batches(current_stage))").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("plm_products").select("*, plm_collections(name), factory_catalog(name), plm_batches(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ collections: collections || [], products: products || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { action } = body;

  if (action === "create_collection") {
    const { name, season, year, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_collections").insert({
      user_id: user.id, name, season, year, notes, status: "active",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, collection: data });
  }

  if (action === "create_product") {
    const { name, sku, description, specs, category, collection_id, factory_id, target_elc, target_sell_price, moq, order_quantity, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_products").insert({
      user_id: user.id, name, sku, description, specs, category,
      collection_id: collection_id || null,
      factory_id: factory_id || null,
      target_elc, target_sell_price, moq, order_quantity, notes,
      milestones: {},
      current_stage: "design_brief",
      stage_updated_at: new Date().toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("plm_stages").insert({
      product_id: data.id, user_id: user.id,
      stage: "design_brief", notes: "Product created",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "update_milestone") {
    const { product_id, milestone, value, force, pin } = body;
    const { data: product } = await supabaseAdmin.from("plm_products").select("milestones").eq("id", product_id).single();
    const currentMilestones = product?.milestones || {};

    // Prevent unchecking unless admin provides correct PIN
    if (!value && currentMilestones[milestone] === true) {
      if (!force || pin !== process.env.ADMIN_MILESTONE_PIN) {
        return NextResponse.json({ error: "pin_required" }, { status: 403 });
      }
    }

    const milestones = { ...currentMilestones, [milestone]: value };
    await supabaseAdmin.from("plm_products").update({ milestones, updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", user.id);
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: user.id,
      stage: milestone, notes: value ? `${milestone.replace(/_/g, " ")} marked complete` : `${milestone.replace(/_/g, " ")} unmarked by admin`,
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "create_batch") {
    const { product_id, quantity, notes, stage } = body;
    const { data: existing } = await supabaseAdmin.from("plm_batches").select("batch_number").eq("product_id", product_id).order("batch_number", { ascending: false }).limit(1);
    const nextBatch = (existing?.[0]?.batch_number || 0) + 1;
    const { data, error } = await supabaseAdmin.from("plm_batches").insert({
      product_id, user_id: user.id,
      batch_number: nextBatch,
      quantity: quantity || null,
      current_stage: stage || "rfq_sent",
      stage_updated_at: new Date().toISOString(),
      notes: notes || "",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id: data.id, product_id, user_id: user.id,
      stage: stage || "rfq_sent",
      notes: "Batch created",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true, batch: data });
  }

  if (action === "update_batch_stage") {
    const { batch_id, product_id, stage, notes } = body;
    await supabaseAdmin.from("plm_batches").update({
      current_stage: stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", batch_id).eq("user_id", user.id);
    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id, product_id, user_id: user.id,
      stage, notes: notes || "",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_batch") {
    await supabaseAdmin.from("plm_batch_stages").delete().eq("batch_id", body.id);
    await supabaseAdmin.from("plm_batches").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "update_product") {
    const { id, ...updates } = body;
    delete updates.action;
    const { data: existing } = await supabaseAdmin.from("plm_products").select("current_stage").eq("id", id).single();
    const { data, error } = await supabaseAdmin.from("plm_products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Log stage change to history
    if (updates.current_stage && updates.current_stage !== existing?.current_stage) {
      await supabaseAdmin.from("plm_stages").insert({
        product_id: id, user_id: user.id,
        stage: updates.current_stage,
        notes: "Development stage updated",
        updated_by: user.email, updated_by_role: "admin",
      });
    }
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "delete_product") {
    await supabaseAdmin.from("plm_stages").delete().eq("product_id", body.id);
    await supabaseAdmin.from("plm_batch_stages").delete().eq("product_id", body.id);
    await supabaseAdmin.from("plm_batches").delete().eq("product_id", body.id);
    await supabaseAdmin.from("plm_products").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "approve_product") {
    const { id } = body;
    // Mark approved + auto-complete all milestones
    await supabaseAdmin.from("plm_products").update({
      approval_status: "approved",
      milestones: { design_brief: true, sampling: true, sample_approved: true },
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("user_id", user.id);
    // Log to stage history
    await supabaseAdmin.from("plm_stages").insert({
      product_id: id, user_id: user.id,
      stage: "sample_approved", notes: "Product approved by admin — all pre-production milestones marked complete",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_collection") {
    await supabaseAdmin.from("plm_collections").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
