import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPortalUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin.from("factory_portal_users").select("*")
    .eq("session_token", token).eq("role", "designer").single();
  if (!data) return null;
  if (new Date(data.session_expires_at) < new Date()) return null;
  return data;
}

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

async function checkPin(portalUser: any, pin: string): Promise<boolean> {
  if (!portalUser.pin_hash) return false;
  return portalUser.pin_hash === hashPin(pin);
}

export async function GET(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Single product view
  const type = req.nextUrl.searchParams.get("type");
  if (type === "product") {
    const id = req.nextUrl.searchParams.get("id");
    const { data } = await supabaseAdmin.from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*, plm_batch_stages(*)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*))")
      .eq("id", id).eq("user_id", portalUser.user_id).single();
    return NextResponse.json({ product: data });
  }

  const [productsRes, collectionsRes, factoriesRes, samplesRes] = await Promise.all([
    supabaseAdmin.from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name), plm_batches(*, plm_batch_stages(*)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*)), plm_stages(*)")
      .eq("user_id", portalUser.user_id).order("created_at", { ascending: false }),
    supabaseAdmin.from("plm_collections").select("*").eq("user_id", portalUser.user_id).order("created_at", { ascending: false }),
    supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name").eq("user_id", portalUser.user_id).order("name"),
    supabaseAdmin.from("plm_sample_requests").select("*, plm_products(id, name, sku, images), factory_catalog(id, name)")
      .eq("user_id", portalUser.user_id).in("status", ["requested"]).order("priority_order", { ascending: true, nullsFirst: false }),
  ]);

  return NextResponse.json({
    products: productsRes.data || [],
    collections: collectionsRes.data || [],
    factories: factoriesRes.data || [],
    samples: samplesRes.data || [],
    has_pin: !!portalUser.pin_hash,
  });
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // PIN management
  if (action === "set_pin") {
    const { pin } = body;
    await supabaseAdmin.from("factory_portal_users").update({ pin_hash: hashPin(pin) }).eq("id", portalUser.id);
    return NextResponse.json({ success: true });
  }

  if (action === "verify_pin") {
    const { pin } = body;
    if (await checkPin(portalUser, pin)) return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  // Product actions
  if (action === "create_product") {
    const { name, sku, description, specs, category, collection_id, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_products").insert({
      user_id: portalUser.user_id, name, sku, description, specs, category,
      collection_id: collection_id || null, notes: notes || null,
      milestones: {}, current_stage: "concept",
      stage_updated_at: new Date().toISOString(),
      submitted_by_designer: true, designer_name: portalUser.name || portalUser.email,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("plm_stages").insert({
      product_id: data.id, user_id: portalUser.user_id, stage: "concept",
      notes: `Created by ${portalUser.name || portalUser.email}`,
      updated_by: portalUser.email, updated_by_role: "designer",
    });
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "create_collection") {
    const { name, season, year, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_collections").insert({
      user_id: portalUser.user_id, name, season, year: parseInt(year) || new Date().getFullYear(),
      notes: notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, collection: data });
  }

  if (action === "update_stage") {
    const { product_id, stage, note } = body;
    await supabaseAdmin.from("plm_products").update({ current_stage: stage, updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: portalUser.user_id, stage, notes: note || "",
      updated_by: portalUser.email, updated_by_role: "designer",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "update_product") {
    const { product_id, ...updates } = body;
    delete updates.action;
    await supabaseAdmin.from("plm_products").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  // PIN-required actions
  if (action === "set_status") {
    const { product_id, status, pin } = body;
    if (!(await checkPin(portalUser, pin))) return NextResponse.json({ error: "pin_required" }, { status: 403 });
    const noteMap: Record<string, string> = {
      progression: "Set to Progression", hold: "Put on Hold", killed: "Killed",
    };
    await supabaseAdmin.from("plm_products").update({ status, killed: status === "killed", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: portalUser.user_id, stage: `status_${status}`,
      notes: noteMap[status] || status, updated_by: portalUser.email, updated_by_role: "designer",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "update_sample_stage") {
    const { sample_request_id, product_id, factory_id, stage, notes, outcome, pin } = body;
    if (outcome && !(await checkPin(portalUser, pin))) return NextResponse.json({ error: "pin_required" }, { status: 403 });

    const updates: any = { current_stage: stage, updated_at: new Date().toISOString() };
    if (outcome) updates.status = outcome;
    if (notes) updates.notes = notes;

    await supabaseAdmin.from("plm_sample_requests").update(updates).eq("id", sample_request_id);
    await supabaseAdmin.from("plm_sample_stages").insert({
      sample_request_id, product_id, factory_id, user_id: portalUser.user_id,
      stage, notes: notes || "", updated_by: portalUser.email, updated_by_role: "designer",
    });

    if (outcome === "approved") {
      await supabaseAdmin.from("plm_products").update({ current_stage: "sample_approved", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
      await supabaseAdmin.from("plm_stages").insert({
        product_id, user_id: portalUser.user_id, stage: "sample_approved",
        notes: `Sample approved by ${portalUser.name || portalUser.email}`,
        updated_by: portalUser.email, updated_by_role: "designer",
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "create_sample_requests") {
    const { product_id, factory_ids, note } = body;
    for (const factoryId of factory_ids) {
      const { data: existing } = await supabaseAdmin.from("plm_sample_requests")
        .select("id, status").eq("product_id", product_id).eq("factory_id", factoryId).in("status", ["requested", "approved"]);
      if (existing?.length) continue;
      const { data: prios } = await supabaseAdmin.from("plm_sample_requests")
        .select("priority_order").eq("factory_id", factoryId).eq("user_id", portalUser.user_id).eq("status", "requested").not("priority_order", "is", null);
      const maxPrio = (prios || []).reduce((max: number, r: any) => Math.max(max, r.priority_order || 0), 0);
      const { data: newReq } = await supabaseAdmin.from("plm_sample_requests").insert({
        product_id, factory_id: factoryId, user_id: portalUser.user_id,
        status: "requested", current_stage: "sample_production",
        notes: note || "", priority_order: maxPrio + 1,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).select().single();
      if (newReq) {
        await supabaseAdmin.from("plm_sample_stages").insert({
          sample_request_id: newReq.id, product_id, factory_id: factoryId, user_id: portalUser.user_id,
          stage: "sample_production", notes: note || "Sample requested",
          updated_by: portalUser.email, updated_by_role: "designer",
        });
      }
    }
    await supabaseAdmin.from("plm_products").update({ current_stage: "samples_requested", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "save_priorities") {
    const { factory_id, ordered_ids } = body;
    for (let i = 0; i < ordered_ids.length; i++) {
      await supabaseAdmin.from("plm_sample_requests").update({ priority_order: i + 1 }).eq("id", ordered_ids[i]).eq("user_id", portalUser.user_id);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
