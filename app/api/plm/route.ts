import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { createHash } from "crypto";
function hashPin(pin: string) { return createHash("sha256").update(pin + "jimmy-pin-salt").digest("hex"); }
async function checkPin(userId: string, pin: string, designerId?: string): Promise<boolean> {
  // If designer, check their portal PIN instead
  if (designerId) {
    const { data: pu } = await supabaseAdmin.from("factory_portal_users").select("pin_hash").eq("supabase_user_id", designerId).single();
    if (pu?.pin_hash) return pu.pin_hash === createHash("sha256").update(pin).digest("hex");
    return false;
  }
  const { data } = await supabaseAdmin.from("profiles").select("admin_pin").eq("id", userId).single();
  if (data?.admin_pin) return data.admin_pin === hashPin(pin);
  return pin === process.env.ADMIN_MILESTONE_PIN;
}

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // If designer, use admin_user_id as effective user
  const { data: profile } = await supabaseAdmin.from("profiles").select("is_designer, admin_user_id").eq("id", user.id).single();
  if (profile?.is_designer && profile?.admin_user_id) {
    return { ...user, id: profile.admin_user_id, _is_designer: true, _designer_id: user.id };
  }
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
      .select("*, plm_collections(name, season, year), factory_catalog(name), plm_batches(*), plm_assignments(*, factory_portal_users(id, name, email))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (collectionId) query = query.eq("collection_id", collectionId);
    const { data } = await query;
    return NextResponse.json({ products: data || [] });
  }

  if (type === "designers") {
    const { data } = await supabaseAdmin.from("factory_portal_users")
      .select("id, name, email, role").eq("user_id", user.id).eq("role", "designer");
    return NextResponse.json({ designers: data || [] });
  }

  if (type === "action_counts") {
    const { data: products } = await supabaseAdmin.from("plm_products")
      .select("id, action_status, plm_batches(id)").eq("user_id", user.id).eq("killed", false);
    const action_required = (products || []).filter((p: any) => p.action_status === "action_required" && !(p.plm_batches || []).length).length;
    const updates_made = (products || []).filter((p: any) => p.action_status === "updates_made").length;
    return NextResponse.json({ action_required, updates_made });
  }

  if (type === "product") {
    const id = req.nextUrl.searchParams.get("id");
    const { data } = await supabaseAdmin
      .from("plm_products")
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*, plm_batch_stages(*)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*)), plm_assignments(*, factory_portal_users(id, name, email, role)), plm_factory_tracks(*, factory_catalog(id, name), plm_track_stages(*))")
      .eq("id", id)
      .single();
    return NextResponse.json({ product: data });
  }

  const [{ data: collections }, { data: products }, { data: factories }] = await Promise.all([
    supabaseAdmin.from("plm_collections").select("*, plm_products(id, name, sku, images, action_status, action_note, status, killed, notes, factory_notes, plm_factory_tracks(id, factory_id, status, approved_price, factory_catalog(id, name), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number)))").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("plm_products").select("*, plm_collections(name), factory_catalog(name), plm_batches(*), plm_sample_requests(id, status, factory_id, factory_catalog(id, name, email))").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name").eq("user_id", user.id).order("name", { ascending: true }),
  ]);

  return NextResponse.json({ collections: collections || [], products: products || [], factories: factories || [] });
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
      if (!force || !(await checkPin(user.id, pin, (user as any)._designer_id))) {
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
    const { product_id, quantity, notes, stage, factory_id, order_quantity, unit_price, tariff, freight, duty, elc, sell_price, margin, linked_po_number, payment_terms, batch_notes } = body;
    const { data: existing } = await supabaseAdmin.from("plm_batches").select("batch_number").eq("product_id", product_id).order("batch_number", { ascending: false }).limit(1);
    const nextBatch = (existing?.[0]?.batch_number || 0) + 1;
    const { data, error } = await supabaseAdmin.from("plm_batches").insert({
      product_id, user_id: user.id,
      batch_number: nextBatch,
      quantity: quantity || order_quantity || null,
      order_quantity: order_quantity || quantity || null,
      factory_id: factory_id || null,
      unit_price: unit_price || null,
      tariff: tariff || null,
      freight: freight || null,
      duty: duty || null,
      elc: elc || null,
      sell_price: sell_price || null,
      margin: margin || null,
      linked_po_number: linked_po_number || null,
      payment_terms: payment_terms || null,
      current_stage: stage || "po_issued",
      stage_updated_at: new Date().toISOString(),
      notes: batch_notes || notes || "",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id: data.id, product_id, user_id: user.id,
      stage: stage || "rfq_sent",
      notes: "Batch created",
      updated_by: user.email, updated_by_role: "admin",
    });
    // PO created — clear action_required
    await supabaseAdmin.from("plm_products").update({ action_status: "up_to_date", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", user.id);
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
    // Audit log stage change
    if (updates.current_stage && existing?.current_stage !== updates.current_stage) {
      auditLog(user.id, "plm_stage_update", { product_id: id, from: existing?.current_stage, to: updates.current_stage }).catch(() => {});
    }
    // Log stage change to history
    if (updates.current_stage && updates.current_stage !== existing?.current_stage) {
      const { error: stageErr } = await supabaseAdmin.from("plm_stages").insert({
        product_id: id, user_id: user.id,
        stage: updates.current_stage,
        notes: updates._stage_note || "",
        updated_by: user.email, updated_by_role: "admin",
        created_at: new Date().toISOString(),
      });
      if (stageErr) console.error("plm_stages insert error:", stageErr);
      delete updates._stage_note;
    }
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "delete_product") {
    const pid = body.product_id || body.id;
    await supabaseAdmin.from("plm_track_stages").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_factory_tracks").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_sample_requests").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_batch_stages").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_batches").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_assignments").delete().eq("product_id", pid);
    await supabaseAdmin.from("plm_products").delete().eq("id", pid).eq("user_id", user.id);
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
      stage: "sample_approved", notes: "Product approved by admin - all pre-production milestones marked complete",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "create_sample_requests") {
    const { product_id, factory_ids, note, force, label, qty } = body;
    if (!product_id || !factory_ids?.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    auditLog(user.id, "sample_request", { product_id, factory_ids, qty }).catch(() => {});

    // Get factory details
    const { data: factories } = await supabaseAdmin
      .from("factory_catalog")
      .select("id, name, email, contact_name")
      .in("id", factory_ids);

    // Create sample request per factory - skip if already exists and not killed
    const skippedFactories: string[] = [];
    for (const factory of (factories || [])) {
      // Check if approved or active request exists
      const { data: existingAny } = await supabaseAdmin
        .from("plm_sample_requests")
        .select("id, status")
        .eq("product_id", product_id)
        .eq("factory_id", factory.id)
        .in("status", ["requested", "approved"]);

      const hasApproved = (existingAny || []).some((r: any) => r.status === "approved");
      const hasActive = (existingAny || []).some((r: any) => r.status === "requested");

      if (hasApproved && !force) {
        skippedFactories.push(factory.name);
        continue; // Sample already approved - block unless force (additional sample)
      }

      if (hasActive && !force) {
        skippedFactories.push(factory.name);
        continue; // Already has active request
      }
      // Force always creates a new row - skip the killed check
      if (force) {
        const { data: fprios } = await supabaseAdmin.from("plm_sample_requests").select("priority_order").eq("factory_id", factory.id).eq("user_id", user.id).eq("status", "requested").not("priority_order", "is", null);
        const fmaxPrio = (fprios || []).reduce((max: number, r: any) => Math.max(max, r.priority_order || 0), 0);
        await supabaseAdmin.from("plm_sample_requests").insert({
          product_id,
          factory_id: factory.id,
          user_id: user.id,
          status: "requested",
          current_stage: "sample_production",
          notes: note || "",
          label: label || null,
          qty: qty || null,
          priority_order: fmaxPrio + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        // Get the newly created request ID
        const { data: newReq } = await supabaseAdmin
          .from("plm_sample_requests")
          .select("id")
          .eq("product_id", product_id)
          .eq("factory_id", factory.id)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (newReq) {
          await supabaseAdmin.from("plm_sample_stages").insert({
            sample_request_id: newReq.id,
            product_id, factory_id: factory.id, user_id: user.id,
            stage: "sample_production",
            notes: note || "Additional sample requested",
            updated_by: user.email, updated_by_role: "admin",
          });
        }
        continue;
      }

      // Check for killed request to reset
      const { data: killedRequests } = await supabaseAdmin
        .from("plm_sample_requests")
        .select("id, status")
        .eq("product_id", product_id)
        .eq("factory_id", factory.id)
        .eq("status", "killed")
        .order("created_at", { ascending: false })
        .limit(1);

      const existing = killedRequests?.[0] || null;

      if (existing) {
        await supabaseAdmin.from("plm_sample_requests").update({
          status: "requested",
          current_stage: "sample_production",
          notes: note || "",
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        const { data: sprios } = await supabaseAdmin.from("plm_sample_requests").select("priority_order").eq("factory_id", factory.id).eq("user_id", user.id).eq("status", "requested").not("priority_order", "is", null);
        const smaxPrio = (sprios || []).reduce((max: number, r: any) => Math.max(max, r.priority_order || 0), 0);
        await supabaseAdmin.from("plm_sample_requests").insert({
          product_id,
          factory_id: factory.id,
          user_id: user.id,
          status: "requested",
          current_stage: "sample_production",
          notes: note || "",
          label: label || null,
          priority_order: smaxPrio + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Log to sample stages
      const { data: newReq } = await supabaseAdmin
        .from("plm_sample_requests")
        .select("id")
        .eq("product_id", product_id)
        .eq("factory_id", factory.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      await supabaseAdmin.from("plm_sample_stages").insert({
        sample_request_id: newReq?.id,
        product_id,
        factory_id: factory.id,
        user_id: user.id,
        stage: "sample_production",
        notes: "Sample requested",
        updated_by: user.email,
        updated_by_role: "admin",
      });
    }

    // Update product stage + notes (only if not force AND at least one new request was created)
    const newlyCreated = (factories || []).filter((f: any) => !skippedFactories.includes(f.name));
    const factoryNames = newlyCreated.map((f: any) => f.name).join(", ");
    if (!force && newlyCreated.length > 0) {
      const noteEntry = note
        ? `Samples Requested: requested from ${factoryNames} - ${note}`
        : `Samples Requested: requested from ${factoryNames}`;
      const { data: product } = await supabaseAdmin.from("plm_products").select("notes, factory_notes").eq("id", product_id).single();
      const updatedNotes = product?.notes ? `${product.notes}
${noteEntry}` : noteEntry;
      // Also save the note to factory_notes so factory can see it
      const updatedFactoryNotes = note
        ? (product?.factory_notes ? `${product.factory_notes}
${note}` : note)
        : product?.factory_notes || null;

      await supabaseAdmin.from("plm_products").update({
        current_stage: "samples_requested",
        notes: updatedNotes,
        factory_notes: updatedFactoryNotes,
        updated_at: new Date().toISOString(),
      }).eq("id", product_id).eq("user_id", user.id);

      await supabaseAdmin.from("plm_stages").insert({
        product_id, user_id: user.id,
        stage: "samples_requested",
        notes: `Sample requested from ${factoryNames}`,
        updated_by: user.email, updated_by_role: "admin",
      });
    }

    // Get user profile for sign-off name
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = userProfile?.full_name || "The Team";

    // Get product name
    const { data: productData } = await supabaseAdmin
      .from("plm_products")
      .select("name, sku")
      .eq("id", product_id)
      .single();
    const productName = productData?.name || "product";

    // Don't send email if no new requests were created or if force
    const actuallyCreated = (factories || []).filter((f: any) => !skippedFactories.includes(f.name));
    const { provider } = body;
    // If provider is explicitly passed, always send email (user just picked from modal)
    if (force || (actuallyCreated.length === 0 && !provider)) {
      return NextResponse.json({ success: true, factories, skipped: skippedFactories });
    }

    // Check which email providers are connected
    const { data: gmailConn } = await supabaseAdmin
      .from("gmail_connections")
      .select("access_token, refresh_token, token_expiry")
      .eq("user_id", user.id)
      .single();

    const { data: msConn } = await supabaseAdmin
      .from("microsoft_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .single();

    // Always use Microsoft if connected, Gmail as fallback
    const useGmail = gmailConn && !msConn;

    const buildEmailBody = (contactName: string) =>
      `Hi ${contactName},

We have submitted a sample request for ${productName}${productData?.sku ? ` (${productData.sku})` : ""}. Please log into the portal to view the full product details and update the sample status as you progress.${note ? `

Note: ${note}` : ""}

Portal: https://portal.myjimmy.ai

Best regards,
${senderName}`;

    if (useGmail) {
      let accessToken = gmailConn.access_token;
      if (new Date(gmailConn.token_expiry) < new Date()) {
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ refresh_token: gmailConn.refresh_token, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
        });
        const rd = await r.json();
        if (rd.access_token) {
          accessToken = rd.access_token;
          await supabaseAdmin.from("gmail_connections").update({ access_token: rd.access_token, token_expiry: new Date(Date.now() + rd.expires_in * 1000).toISOString() }).eq("user_id", user.id);
        }
      }
      for (const factory of (factories || [])) {
        if (!factory.email) continue;
        const contactName = (factory as any).contact_name || factory.name;
        const mime = [`MIME-Version: 1.0`, `To: ${factory.email}`, `Subject: Sample Request - ${productName}`, `Content-Type: text/plain; charset=utf-8`, ``, buildEmailBody(contactName)].join("\r\n");
        const encoded = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw: encoded }),
        }).catch(() => {});
      }
    } else if (msConn) {
      let accessToken = msConn.access_token;
      if (new Date(msConn.expires_at) < new Date()) {
        const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ refresh_token: msConn.refresh_token, client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!, grant_type: "refresh_token", scope: "https://graph.microsoft.com/.default offline_access" }),
        });
        const rd = await r.json();
        if (rd.access_token) {
          accessToken = rd.access_token;
          await supabaseAdmin.from("microsoft_connections").update({ access_token: rd.access_token, expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString() }).eq("user_id", user.id);
        }
      }
      for (const factory of (factories || [])) {
        if (!factory.email) continue;
        const contactName = (factory as any).contact_name || factory.name;
        await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { subject: `Sample Request - ${productName}`, body: { contentType: "Text", content: buildEmailBody(contactName) }, toRecipients: [{ emailAddress: { address: factory.email } }] } }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, factories, skipped: skippedFactories });
  }

  if (action === "bulk_sample_requests") {
    const { items, note, provider } = body;
    if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

    // Get all unique factory IDs
    const allFactoryIds = Array.from(new Set(items.flatMap((i: any) => i.factory_ids || [])));
    const { data: allFactories } = await supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name").in("id", allFactoryIds);
    const factoryMap: Record<string, any> = {};
    (allFactories || []).forEach((f: any) => { factoryMap[f.id] = f; });

    // Get all product details
    const allProductIds = items.map((i: any) => i.product_id);
    const { data: allProducts } = await supabaseAdmin.from("plm_products").select("id, name, sku, current_stage, notes").in("id", allProductIds).eq("user_id", user.id);
    const productMap: Record<string, any> = {};
    (allProducts || []).forEach((p: any) => { productMap[p.id] = p; });

    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).single();
    const senderName = profile?.full_name || user.email;

    // Process each item - create sample requests in DB
    for (const item of items) {
      const { product_id, factory_ids, note: itemNote, force, label, qty } = item;
      for (const factoryId of (factory_ids || [])) {
        const { data: existingAny } = await supabaseAdmin.from("plm_sample_requests").select("id, status").eq("product_id", product_id).eq("factory_id", factoryId).in("status", ["requested", "approved"]);
        const hasApproved = (existingAny || []).some((r: any) => r.status === "approved");
        const hasActive = (existingAny || []).some((r: any) => r.status === "requested");
        if ((hasApproved || hasActive) && !force) continue;

        // Get next priority number for this factory
        const { data: existingPrios } = await supabaseAdmin.from("plm_sample_requests")
          .select("priority_order").eq("factory_id", factoryId).eq("user_id", user.id)
          .eq("status", "requested").not("priority_order", "is", null);
        const maxPrio = (existingPrios || []).reduce((max: number, r: any) => Math.max(max, r.priority_order || 0), 0);
        const nextPrio = maxPrio + 1;

        const { data: newReq } = await supabaseAdmin.from("plm_sample_requests").insert({
          product_id, factory_id: factoryId, user_id: user.id,
          status: "requested", current_stage: "sample_production",
          notes: itemNote || note || "", label: label || null, qty: qty || null,
          priority_order: nextPrio,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).select().single();

        if (newReq) {
          await supabaseAdmin.from("plm_sample_stages").insert({
            sample_request_id: newReq.id, product_id, factory_id: factoryId, user_id: user.id,
            stage: "sample_production", notes: itemNote || note || "Sample requested",
            updated_by: user.email, updated_by_role: "admin",
          });
        }

        // Update product stage
        const product = productMap[product_id];
        if (product && !["samples_requested","sample_production","sample_complete","sample_shipped","sample_arrived","sample_approved"].includes(product.current_stage)) {
          await supabaseAdmin.from("plm_products").update({ current_stage: "samples_requested", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", user.id);
          await supabaseAdmin.from("plm_stages").insert({
            product_id, user_id: user.id, stage: "samples_requested",
            notes: `Sample requested from ${factoryMap[factoryId]?.name || "factory"}`,
            updated_by: user.email, updated_by_role: "admin",
          });
        }
      }
    }

    // Send one email per factory listing all their products
    const { data: gmailConn } = await supabaseAdmin.from("gmail_connections").select("access_token, refresh_token, token_expiry").eq("user_id", user.id).single();
    const { data: msConn } = await supabaseAdmin.from("microsoft_connections").select("access_token, refresh_token, expires_at").eq("user_id", user.id).single();
    // Always use Microsoft if connected, Gmail as fallback
    const useGmail = gmailConn && !msConn;

    for (const factoryId of allFactoryIds) {
      const factory = factoryMap[factoryId as string];
      if (!factory?.email) continue;

      // Get products for this factory
      const factoryProducts = items.filter((i: any) => (i.factory_ids || []).includes(factoryId)).map((i: any) => productMap[i.product_id]).filter(Boolean);
      if (!factoryProducts.length) continue;

      const productList = factoryProducts.map((p: any) => "- " + p.name + (p.sku ? " (" + p.sku + ")" : "")).join("\n");
      const contactName = factory.contact_name || factory.name;
      const emailBody = "Hi " + contactName + ",\n\nWe have submitted sample requests for the following product" + (factoryProducts.length > 1 ? "s" : "") + ":\n\n" + productList + "\n\nPlease log into the factory portal to view full product details and update sample status as you progress." + (note ? "\n\nNote: " + note : "") + "\n\nPortal: https://portal.myjimmy.ai\n\nBest regards,\n" + senderName;

      const subject = "Sample Request" + (factoryProducts.length > 1 ? "s (" + factoryProducts.length + " products)" : " - " + (factoryProducts[0]?.name || ""));

      if (useGmail && gmailConn) {
        let accessToken = gmailConn.access_token;
        if (new Date(gmailConn.token_expiry) < new Date()) {
          const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: gmailConn.refresh_token, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }) });
          const rd = await r.json();
          if (rd.access_token) { accessToken = rd.access_token; await supabaseAdmin.from("gmail_connections").update({ access_token: rd.access_token, token_expiry: new Date(Date.now() + rd.expires_in * 1000).toISOString() }).eq("user_id", user.id); }
        }
        const mime = ["MIME-Version: 1.0", "To: " + factory.email, "Subject: " + subject, "Content-Type: text/plain; charset=utf-8", "", emailBody].join("\r\n");
        const encoded = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: encoded }) }).catch(() => {});
      } else if (msConn) {
        let accessToken = msConn.access_token;
        if (new Date(msConn.expires_at) < new Date()) {
          const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: msConn.refresh_token, client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!, grant_type: "refresh_token", scope: "https://graph.microsoft.com/.default offline_access" }) });
          const rd = await r.json();
          if (rd.access_token) { accessToken = rd.access_token; await supabaseAdmin.from("microsoft_connections").update({ access_token: rd.access_token, expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString() }).eq("user_id", user.id); }
        }
        await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: emailBody }, toRecipients: [{ emailAddress: { address: factory.email } }] } }) }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete_sample_request") {
    const { sample_request_id } = body;
    await supabaseAdmin.from("plm_sample_stages").delete().eq("sample_request_id", sample_request_id);
    await supabaseAdmin.from("plm_sample_requests").delete().eq("id", sample_request_id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "update_sample_stage") {
    const { sample_request_id, product_id, factory_id, stage, notes, outcome, pin } = body;

    // PIN required for outcome decisions
    if (outcome && !(await checkPin(user.id, pin, (user as any)._designer_id))) {
      return NextResponse.json({ error: "pin_required" }, { status: 403 });
    }

    // Handle unkill factory
    if (outcome === "unkill") {
      await supabaseAdmin.from("plm_sample_requests").update({
        status: "requested",
        current_stage: "sample_production",
        updated_at: new Date().toISOString(),
      }).eq("id", sample_request_id);
      await supabaseAdmin.from("plm_sample_stages").insert({
        sample_request_id, product_id, factory_id, user_id: user.id,
        stage: "sample_production",
        notes: "Factory revived by admin",
        updated_by: user.email, updated_by_role: "admin",
      });
      return NextResponse.json({ success: true });
    }

    const updates: any = { current_stage: stage, updated_at: new Date().toISOString() };
    if (outcome) updates.status = outcome;
    if (notes) updates.notes = notes;

    // Handle revision - mark current request as revision_complete, create new request for round 2
    if (outcome === "revision") {
      // Close current request with revision status
      await supabaseAdmin.from("plm_sample_requests").update({
        status: "revision",
        notes: notes || "",
        updated_at: new Date().toISOString(),
      }).eq("id", sample_request_id);

      // Log revision stage to current request
      await supabaseAdmin.from("plm_sample_stages").insert({
        sample_request_id, product_id, factory_id, user_id: user.id,
        stage: "revision_requested",
        notes: notes || "Revision requested",
        updated_by: user.email, updated_by_role: "admin",
      });

      // Create new request for next round
      const { data: newReq } = await supabaseAdmin.from("plm_sample_requests").insert({
        product_id, factory_id, user_id: user.id,
        status: "requested",
        current_stage: "sample_production",
        label: "revision",
        notes: notes || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single();

      if (newReq) {
        await supabaseAdmin.from("plm_sample_stages").insert({
          sample_request_id: newReq.id, product_id, factory_id, user_id: user.id,
          stage: "sample_production",
          notes: "Revision round started",
          updated_by: user.email, updated_by_role: "admin",
        });
      }

      // Log to product notes
      const { data: factoryDataRev } = await supabaseAdmin.from("factory_catalog").select("name").eq("id", factory_id).single();
      const { data: productDataRev } = await supabaseAdmin.from("plm_products").select("notes").eq("id", product_id).single();
      const revNote = `Revision Requested to ${factoryDataRev?.name || "factory"}: ${notes || ""}`;
      const revNotes = productDataRev?.notes ? `${productDataRev.notes}
${revNote}` : revNote;
      await supabaseAdmin.from("plm_products").update({ notes: revNotes, updated_at: new Date().toISOString() }).eq("id", product_id);
      await supabaseAdmin.from("plm_stages").insert({
        product_id, user_id: user.id, stage: "revision_requested",
        notes: revNote, updated_by: user.email, updated_by_role: "admin",
      });
      await supabaseAdmin.from("plm_products").update({
        action_status: "updates_made",
        updated_at: new Date().toISOString(),
      }).eq("id", product_id);
      return NextResponse.json({ success: true });
    }

    await supabaseAdmin.from("plm_sample_requests").update(updates).eq("id", sample_request_id);

    await supabaseAdmin.from("plm_sample_stages").insert({
      sample_request_id, product_id, factory_id, user_id: user.id,
      stage,
      notes: notes || "",
      updated_by: user.email, updated_by_role: "admin",
    });
    // Mark sample arrived = action required (needs approve/kill/revise)
    if (stage === "sample_arrived") {
      await supabaseAdmin.from("plm_products").update({ action_status: "action_required", updated_at: new Date().toISOString() }).eq("id", product_id);
    }

    // Log to product notes
    const { data: factoryData } = await supabaseAdmin.from("factory_catalog").select("name").eq("id", factory_id).single();
    const factoryName = factoryData?.name || "factory";
    const { data: productData } = await supabaseAdmin.from("plm_products").select("notes, plm_sample_requests(id, factory_id, status)").eq("id", product_id).single();

    let noteEntry = "";
    if (outcome === "approved") {
      noteEntry = `Sample Approved: ${factoryName} selected for production`;
      // Auto-kill all other factories
      const otherRequests = (productData?.plm_sample_requests || []).filter((r: any) => r.id !== sample_request_id && r.status !== "killed");
      for (const other of otherRequests) {
        const { data: otherFactory } = await supabaseAdmin.from("factory_catalog").select("name").eq("id", other.factory_id).single();
        await supabaseAdmin.from("plm_sample_requests").update({
          status: "killed",
          notes: `Auto-killed - production started with ${factoryName}`,
          updated_at: new Date().toISOString(),
        }).eq("id", other.id);
        await supabaseAdmin.from("plm_sample_stages").insert({
          sample_request_id: other.id, product_id, factory_id: other.factory_id, user_id: user.id,
          stage: "killed",
          notes: `Disregard sample - production started with ${factoryName}`,
          updated_by: user.email, updated_by_role: "admin",
        });
      }
      // Update product to sample_approved
      await supabaseAdmin.from("plm_products").update({
        current_stage: "sample_approved",
        action_status: "action_required",
        updated_at: new Date().toISOString(),
      }).eq("id", product_id);
      // If product already has orders, no action needed
      const { data: existingBatches } = await supabaseAdmin.from("plm_batches").select("id").eq("product_id", product_id).limit(1);
      if (existingBatches && existingBatches.length > 0) {
        await supabaseAdmin.from("plm_products").update({ action_status: "up_to_date", updated_at: new Date().toISOString() }).eq("id", product_id);
      }
      await supabaseAdmin.from("plm_stages").insert({
        product_id, user_id: user.id,
        stage: "sample_approved",
        notes: `Sample approved - ${factoryName} selected`,
        updated_by: user.email, updated_by_role: "admin",
      });
    } else if (outcome === "revision") {
      noteEntry = `Revision Requested to ${factoryName}: ${notes || ""}`;
    } else if (outcome === "killed") {
      noteEntry = notes?.includes("entirely") || notes?.includes("Product killed")
        ? `Product Killed: ${notes}`
        : `Sample Killed for ${factoryName}: ${notes || ""}`;
      // If killing product, kill all factories and mark product as killed
      if (notes?.includes("Product killed")) {
        const allRequests = (productData?.plm_sample_requests || []).filter((r: any) => r.id !== sample_request_id && r.status !== "killed");
        for (const other of allRequests) {
          await supabaseAdmin.from("plm_sample_requests").update({
            status: "killed",
            notes: "Product killed",
            updated_at: new Date().toISOString(),
          }).eq("id", other.id);
        }
        await supabaseAdmin.from("plm_products").update({
          killed: true,
          status: "killed",
          updated_at: new Date().toISOString(),
        }).eq("id", product_id);
      }
    }

    if (noteEntry) {
      const updatedNotes = productData?.notes ? `${productData.notes}
${noteEntry}` : noteEntry;
      await supabaseAdmin.from("plm_products").update({ notes: updatedNotes, updated_at: new Date().toISOString() }).eq("id", product_id);
    }

    // Update action_status based on outcome
    if (outcome === "killed" || outcome === "unkill") {
      await supabaseAdmin.from("plm_products").update({ action_status: "up_to_date", updated_at: new Date().toISOString() }).eq("id", product_id);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "get_sample_requests") {
    const { product_id } = body;
    const { data } = await supabaseAdmin
      .from("plm_sample_requests")
      .select("*, factory_catalog(name, email), plm_sample_stages(*)")
      .eq("product_id", product_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ sample_requests: data || [] });
  }

  if (action === "set_product_status") {
    const { product_id, status, pin } = body;
    if (!(await checkPin(user.id, pin, (user as any)._designer_id))) {
      return NextResponse.json({ error: "pin_required" }, { status: 403 });
    }
    if (!["progression", "hold", "killed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await supabaseAdmin.from("plm_products").update({
      status,
      killed: status === "killed",
      updated_at: new Date().toISOString(),
    }).eq("id", product_id).eq("user_id", user.id);
    const noteMap: Record<string, string> = {
      progression: "Product set to Progression - moving forward",
      hold: "Product placed on Hold - paused but not cancelled",
      killed: "Product Killed - no longer moving forward",
    };
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: user.id,
      stage: `status_${status}`,
      notes: noteMap[status],
      updated_by: user.email, updated_by_role: "admin",
    });
    // Clear action status when product status changes
    await supabaseAdmin.from("plm_products").update({ action_status: status === "killed" ? "up_to_date" : "up_to_date", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", user.id);
    // Auto-kill all active sample requests when product is killed
    if (status === "killed") {
      const { data: activeSamples } = await supabaseAdmin.from("plm_sample_requests")
        .select("id").eq("product_id", product_id).eq("status", "requested");
      for (const sr of (activeSamples || [])) {
        await supabaseAdmin.from("plm_sample_requests").update({ status: "killed", updated_at: new Date().toISOString() }).eq("id", sr.id);
        await supabaseAdmin.from("plm_sample_stages").insert({
          sample_request_id: sr.id, product_id, user_id: user.id,
          stage: "killed", notes: "Product killed - sample auto-cancelled",
          updated_by: user.email, updated_by_role: "admin",
        });
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === "delete_collection") {
    await supabaseAdmin.from("plm_collections").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "assign_product") {
    const { product_id, designer_ids } = body;
    // Remove existing assignments
    await supabaseAdmin.from("plm_assignments").delete().eq("product_id", product_id);
    // Add new assignments
    if (designer_ids && designer_ids.length > 0) {
      await supabaseAdmin.from("plm_assignments").insert(
        designer_ids.map((did: string) => ({ product_id, designer_id: did, assigned_by: user.id }))
      );
    }
    return NextResponse.json({ success: true });
  }

  if (action === "dismiss_action") {
    const { product_id } = body;
    await supabaseAdmin.from("plm_products").update({ action_status: "up_to_date", updated_at: new Date().toISOString() }).eq("id", product_id).eq("user_id", user.id);
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: user.id,
      stage: "admin_dismissed",
      notes: "Admin dismissed status update",
      updated_by: user.email, updated_by_role: "admin",
    });
    return NextResponse.json({ success: true });
  }

  if (action === "get_assignment_requests") {
    const { data, error } = await supabaseAdmin.from("assignment_requests")
      .select("*, plm_products(id, name, sku)")
      .eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ requests: [], error: error.message });
    console.log("assignment_requests query - user.id:", user.id, "data:", data?.length, "error:", error);
    // Manually fetch designer info
    const requestsWithDesigners = await Promise.all((data || []).map(async (req: any) => {
      const { data: designer } = await supabaseAdmin.from("factory_portal_users").select("id, name, email").eq("id", req.designer_id).single();
      return { ...req, factory_portal_users: designer };
    }));
    return NextResponse.json({ requests: requestsWithDesigners });
  }

  if (action === "handle_assignment_request") {
    const { request_id, approve } = body;
    const { data: req } = await supabaseAdmin.from("assignment_requests").select("*").eq("id", request_id).single();
    if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await supabaseAdmin.from("assignment_requests").update({ status: approve ? "approved" : "rejected" }).eq("id", request_id);
    if (approve) {
      const { data: existing } = await supabaseAdmin.from("plm_assignments").select("designer_id").eq("product_id", req.product_id);
      const currentIds = (existing || []).map((a: any) => a.designer_id);
      if (!currentIds.includes(req.designer_id)) {
        await supabaseAdmin.from("plm_assignments").insert({ product_id: req.product_id, designer_id: req.designer_id, user_id: user.id });
      }
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
