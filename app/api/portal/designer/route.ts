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
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*, plm_batch_stages(*), factory_catalog(name)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*)), plm_factory_tracks(*, factory_catalog(id, name), plm_track_stages(*))")
      .eq("id", id).eq("user_id", portalUser.user_id).single();
    return NextResponse.json({ product: data });
  }

  const [productsRes, collectionsRes, factoriesRes, samplesRes] = await Promise.all([
    supabaseAdmin.from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name), plm_batches(*, plm_batch_stages(*), factory_catalog(name)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*)), plm_stages(*), plm_assignments(designer_id), plm_factory_tracks(*, factory_catalog(id, name), plm_track_stages(*))")
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

  // Handle multipart image upload
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const product_id = formData.get("product_id") as string;
    if (!file || !product_id) return NextResponse.json({ error: "Missing file or product_id" }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${product_id}/${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("plm-images").upload(filename, buffer, { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: { publicUrl } } = supabaseAdmin.storage.from("plm-images").getPublicUrl(filename);
    // Add to product images array
    const { data: product } = await supabaseAdmin.from("plm_products").select("images").eq("id", product_id).single();
    const images = [...(product?.images || []), publicUrl];
    await supabaseAdmin.from("plm_products").update({ images, updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true, url: publicUrl });
  }

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
    const { product_id, id: productIdAlt, ...updates } = body;
    const pid = product_id || productIdAlt;
    delete updates.action;
    await supabaseAdmin.from("plm_products").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", pid).eq("user_id", portalUser.user_id);
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

  // Alias for product page compatibility
  if (action === "set_product_status") {
    const { product_id, status, pin } = body;
    if (!(await checkPin(portalUser, pin))) return NextResponse.json({ error: "pin_required" }, { status: 403 });
    await supabaseAdmin.from("plm_products").update({ status, killed: status === "killed", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: portalUser.user_id, stage: `status_${status}`,
      notes: status, updated_by: portalUser.email, updated_by_role: "designer",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "approve_product") {
    const { id } = body;
    const devStages = ["concept","ready_for_quote","artwork_sent","quotes_received","samples_requested","sample_approved"];
    const milestones: Record<string,boolean> = {};
    devStages.forEach(s => milestones[s] = true);
    await supabaseAdmin.from("plm_products").update({ current_stage: "sample_approved", milestones, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "delete_sample_request") {
    const { sample_request_id } = body;
    await supabaseAdmin.from("plm_sample_stages").delete().eq("sample_request_id", sample_request_id);
    await supabaseAdmin.from("plm_sample_requests").delete().eq("id", sample_request_id).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "create_batch") {
    const { product_id, stage, factory_id, linked_po_number, order_quantity, target_elc, target_sell_price, moq, batch_notes } = body;
    const { data: batch } = await supabaseAdmin.from("plm_batches").insert({
      product_id, user_id: portalUser.user_id, factory_id: factory_id || null,
      current_stage: stage || "po_issued", linked_po_number: linked_po_number || null,
      order_quantity: order_quantity || null, target_elc: target_elc || null,
      target_sell_price: target_sell_price || null, moq: moq || null, batch_notes: batch_notes || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select().single();
    if (batch) {
      await supabaseAdmin.from("plm_batch_stages").insert({
        batch_id: batch.id, product_id, user_id: portalUser.user_id,
        stage: stage || "po_issued", updated_by: portalUser.email, updated_by_role: "designer",
      });
    }
    return NextResponse.json({ success: true, batch });
  }

  if (action === "update_batch") {
    const { id: batchId, ...updates } = body;
    delete updates.action;
    await supabaseAdmin.from("plm_batches").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", batchId).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "update_batch_stage") {
    const { batch_id, product_id, stage, notes } = body;
    await supabaseAdmin.from("plm_batches").update({ current_stage: stage, updated_at: new Date().toISOString() }).eq("id", batch_id).eq("user_id", portalUser.user_id);
    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id, product_id, user_id: portalUser.user_id, stage, notes: notes || "",
      updated_by: portalUser.email, updated_by_role: "designer",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "delete_batch") {
    const { id: batchId } = body;
    await supabaseAdmin.from("plm_batch_stages").delete().eq("batch_id", batchId);
    await supabaseAdmin.from("plm_batches").delete().eq("id", batchId).eq("user_id", portalUser.user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "save_priorities") {
    const { factory_id, ordered_ids } = body;
    for (let i = 0; i < ordered_ids.length; i++) {
      await supabaseAdmin.from("plm_sample_requests").update({ priority_order: i + 1 }).eq("id", ordered_ids[i]).eq("user_id", portalUser.user_id);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "add_factory_track") {
    const { product_id, factory_id } = body;
    // Check if track already exists
    const { data: existing } = await supabaseAdmin.from("plm_factory_tracks")
      .select("id").eq("product_id", product_id).eq("factory_id", factory_id).single();
    if (existing) return NextResponse.json({ error: "Track already exists" }, { status: 400 });
    
    const { data, error } = await supabaseAdmin.from("plm_factory_tracks").insert({
      product_id,
      factory_id,
      user_id: portalUser.user_id,
      status: "active",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, track: data });
  }

  if (action === "update_track_price") {
    const { track_id, quoted_price } = body;
    await supabaseAdmin.from("plm_factory_tracks")
      .update({ quoted_price, updated_at: new Date().toISOString() })
      .eq("id", track_id);
    return NextResponse.json({ success: true });
  }

  if (action === "update_track_stage") {
    const { track_id, stage, status, actual_date, expected_date, notes, quoted_price, revision_number } = body;
    
    // Get the track to find product_id and factory_id
    const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
      .select("product_id, factory_id").eq("id", track_id).single();
    if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
    
    const revNum = revision_number || 0;

    // Check if stage exists for this revision
    const { data: existing } = await supabaseAdmin.from("plm_track_stages")
      .select("id").eq("track_id", track_id).eq("stage", stage).eq("revision_number", revNum).maybeSingle();
    
    const updateData: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) updateData.status = status;
    if (actual_date !== undefined) updateData.actual_date = actual_date || null;
    if (expected_date !== undefined) updateData.expected_date = expected_date || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (quoted_price !== undefined) updateData.quoted_price = quoted_price || null;

    if (existing) {
      await supabaseAdmin.from("plm_track_stages")
        .update(updateData)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("plm_track_stages").insert({
        track_id,
        product_id: track.product_id,
        factory_id: track.factory_id,
        stage,
        status: status || "pending",
        actual_date: actual_date || null,
        expected_date: expected_date || null,
        notes: notes || null,
        quoted_price: quoted_price || null,
        revision_number: revNum,
        updated_by: portalUser.email || "designer",
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "add_factory_note") {
    const { track_id, note } = body;
    
    // Get the track to find product_id and factory_id
    const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
      .select("product_id, factory_id").eq("id", track_id).single();
    if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
    
    // Add a note as a stage entry
    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id: track.product_id,
      factory_id: track.factory_id,
      stage: "note",
      status: "done",
      notes: note,
      actual_date: new Date().toISOString().split("T")[0],
      updated_by: portalUser.email || "designer",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "approve_track") {
    const { track_id, approved_price } = body;
    
    const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
      .select("product_id, factory_id").eq("id", track_id).single();
    if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
    
    // Mark sample_reviewed as done
    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id: track.product_id,
      factory_id: track.factory_id,
      stage: "sample_reviewed",
      status: "done",
      notes: `Approved${approved_price ? ` at $${approved_price}` : ""}`,
      actual_date: new Date().toISOString().split("T")[0],
      updated_by: portalUser.email || "designer",
    });
    
    // Update the track status to approved
    await supabaseAdmin.from("plm_factory_tracks")
      .update({ status: "approved", approved_price: approved_price || null, updated_at: new Date().toISOString() })
      .eq("id", track_id);
    
    // Kill all other active tracks for this product
    await supabaseAdmin.from("plm_factory_tracks")
      .update({ status: "killed", updated_at: new Date().toISOString() })
      .eq("product_id", track.product_id)
      .eq("status", "active")
      .neq("id", track_id);
    
    return NextResponse.json({ success: true });
  }

  if (action === "request_revision") {
    const { track_id, notes } = body;
    
    const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
      .select("product_id, factory_id").eq("id", track_id).single();
    if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
    
    // Count existing revisions to determine revision_number
    const { data: existingRevisions } = await supabaseAdmin.from("plm_track_stages")
      .select("id").eq("track_id", track_id).eq("stage", "revision_requested");
    const revNum = (existingRevisions?.length || 0) + 1;
    
    // Mark sample_reviewed as done with revision note
    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id: track.product_id,
      factory_id: track.factory_id,
      stage: "sample_reviewed",
      status: "done",
      notes: "Revision requested",
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revNum - 1,
      updated_by: portalUser.email || "designer",
    });
    
    // Add revision_requested stage
    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id: track.product_id,
      factory_id: track.factory_id,
      stage: "revision_requested",
      status: "done",
      notes: notes,
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revNum,
      updated_by: portalUser.email || "designer",
    });
    
    // Auto-mark sample_requested for the new revision cycle
    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id: track.product_id,
      factory_id: track.factory_id,
      stage: "sample_requested",
      status: "done",
      notes: notes || "Revision requested",
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revNum,
      updated_by: portalUser.email || "designer",
    });
    
    return NextResponse.json({ success: true });
  }

  if (action === "kill_track") {
    const { track_id, notes } = body;
    
    const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
      .select("product_id, factory_id").eq("id", track_id).single();
    if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });
    
    // Update the track status to killed
    await supabaseAdmin.from("plm_factory_tracks")
      .update({ status: "killed", updated_at: new Date().toISOString() })
      .eq("id", track_id);
    
    // Add a note stage
    if (notes) {
      await supabaseAdmin.from("plm_track_stages").insert({
        track_id,
        product_id: track.product_id,
        factory_id: track.factory_id,
        stage: "disqualified",
        status: "done",
        notes: notes,
        actual_date: new Date().toISOString().split("T")[0],
        updated_by: portalUser.email || "designer",
      });
    }
    
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { product_id, url } = await req.json();
  // Extract filename from URL
  const parts = url.split("/plm-images/");
  if (parts.length < 2) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  const filename = parts[1];
  await supabaseAdmin.storage.from("plm-images").remove([filename]);
  const { data: product } = await supabaseAdmin.from("plm_products").select("images").eq("id", product_id).single();
  const images = (product?.images || []).filter((img: string) => img !== url);
  await supabaseAdmin.from("plm_products").update({ images, updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", portalUser.user_id);
  return NextResponse.json({ success: true });
}
