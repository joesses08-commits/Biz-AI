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
      .select("*, plm_products(id, current_stage, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ collections: data || [] });
  }

  if (type === "products") {
    const collectionId = req.nextUrl.searchParams.get("collection_id");
    let query = supabaseAdmin
      .from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name, email)")
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
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*)")
      .eq("id", id)
      .single();
    return NextResponse.json({ product: data });
  }

  // Default — return everything
  const [{ data: collections }, { data: products }] = await Promise.all([
    supabaseAdmin.from("plm_collections").select("*, plm_products(id, current_stage, status)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("plm_products").select("*, plm_collections(name), factory_catalog(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
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
      current_stage: "design_brief",
      stage_updated_at: new Date().toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log initial stage
    await supabaseAdmin.from("plm_stages").insert({
      product_id: data.id, user_id: user.id,
      stage: "design_brief", notes: "Product created",
      updated_by: user.email, updated_by_role: "admin",
    });

    return NextResponse.json({ success: true, product: data });
  }

  if (action === "update_stage") {
    const { product_id, stage, notes } = body;
    await supabaseAdmin.from("plm_products").update({
      current_stage: stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", product_id).eq("user_id", user.id);

    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: user.id, stage, notes: notes || "",
      updated_by: user.email, updated_by_role: "admin",
    });

    return NextResponse.json({ success: true });
  }

  if (action === "update_product") {
    const { id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabaseAdmin.from("plm_products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "delete_product") {
    await supabaseAdmin.from("plm_stages").delete().eq("product_id", body.id);
    await supabaseAdmin.from("plm_products").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "delete_collection") {
    await supabaseAdmin.from("plm_collections").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "create_batch") {
    const { product_id, quantity, notes } = body;
    // Get current batch count
    const { data: existing } = await supabaseAdmin.from("plm_batches").select("batch_number").eq("product_id", product_id).order("batch_number", { ascending: false }).limit(1);
    const nextBatch = (existing?.[0]?.batch_number || 0) + 1;
    const { data, error } = await supabaseAdmin.from("plm_batches").insert({
      product_id, user_id: user.id,
      batch_number: nextBatch,
      quantity: quantity || null,
      current_stage: "design_brief",
      stage_updated_at: new Date().toISOString(),
      notes: notes || "",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Log initial stage
    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id: data.id, product_id, user_id: user.id,
      stage: "design_brief", notes: "Batch created",
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

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
