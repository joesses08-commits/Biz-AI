import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { createHash } from "crypto";
function hashPin(pin: string) { return createHash("sha256").update(pin + "jimmy-pin-salt").digest("hex"); }
async function checkPin(userId: string, pin: string): Promise<boolean> {
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
      .select("*, plm_collections(name, season, year), factory_catalog(name, email), plm_stages(*), plm_batches(*, plm_batch_stages(*)), plm_sample_requests(*, factory_catalog(name, email), plm_sample_stages(*))")
      .eq("id", id)
      .single();
    return NextResponse.json({ product: data });
  }

  const [{ data: collections }, { data: products }, { data: factories }] = await Promise.all([
    supabaseAdmin.from("plm_collections").select("*, plm_products(id, milestones, plm_batches(current_stage))").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("plm_products").select("*, plm_collections(name), factory_catalog(name), plm_batches(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
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
      if (!force || !(await checkPin(user.id, pin))) {
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
        notes: updates._stage_note || "",
        updated_by: user.email, updated_by_role: "admin",
      });
      delete updates._stage_note;
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

  if (action === "create_sample_requests") {
    const { product_id, factory_ids, note, force, label, qty } = body;
    if (!product_id || !factory_ids?.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Get factory details
    const { data: factories } = await supabaseAdmin
      .from("factory_catalog")
      .select("id, name, email, contact_name")
      .in("id", factory_ids);

    // Create sample request per factory — skip if already exists and not killed
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
        continue; // Sample already approved — block unless force (additional sample)
      }

      if (hasActive && !force) {
        skippedFactories.push(factory.name);
        continue; // Already has active request
      }
      // Force always creates a new row — skip the killed check
      if (force) {
        await supabaseAdmin.from("plm_sample_requests").insert({
          product_id,
          factory_id: factory.id,
          user_id: user.id,
          status: "requested",
          current_stage: "sample_production",
          notes: note || "",
          label: label || null,
          qty: qty || null,
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
        await supabaseAdmin.from("plm_sample_requests").insert({
          product_id,
          factory_id: factory.id,
          user_id: user.id,
          status: "requested",
          current_stage: "sample_production",
          notes: note || "",
          label: label || null,
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
        ? `Samples Requested: requested from ${factoryNames} — ${note}`
        : `Samples Requested: requested from ${factoryNames}`;
      const { data: product } = await supabaseAdmin.from("plm_products").select("notes").eq("id", product_id).single();
      const updatedNotes = product?.notes ? `${product.notes}
${noteEntry}` : noteEntry;

      await supabaseAdmin.from("plm_products").update({
        current_stage: "samples_requested",
        notes: updatedNotes,
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
    if (force || actuallyCreated.length === 0) {
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

    const bothConnected = !!gmailConn && !!msConn;

    // If both connected, return provider_choice so frontend can ask
    const { provider } = body;
    if (bothConnected && !provider && !force) {
      return NextResponse.json({ 
        success: false, 
        needs_provider: true,
        factories: factories?.map((f: any) => f.name),
      });
    }

    const useGmail = gmailConn && (!msConn || provider === "gmail");

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
        const mime = [`MIME-Version: 1.0`, `To: ${factory.email}`, `Subject: Sample Request — ${productName}`, `Content-Type: text/plain; charset=utf-8`, ``, buildEmailBody(contactName)].join("\r\n");
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
          body: JSON.stringify({ message: { subject: `Sample Request — ${productName}`, body: { contentType: "Text", content: buildEmailBody(contactName) }, toRecipients: [{ emailAddress: { address: factory.email } }] } }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, factories, skipped: skippedFactories });
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
    if (outcome && !(await checkPin(user.id, pin))) {
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

    // Handle revision — mark current request as revision_complete, create new request for round 2
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

      return NextResponse.json({ success: true });
    }

    await supabaseAdmin.from("plm_sample_requests").update(updates).eq("id", sample_request_id);

    await supabaseAdmin.from("plm_sample_stages").insert({
      sample_request_id, product_id, factory_id, user_id: user.id,
      stage,
      notes: notes || "",
      updated_by: user.email, updated_by_role: "admin",
    });

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
          notes: `Auto-killed — production started with ${factoryName}`,
          updated_at: new Date().toISOString(),
        }).eq("id", other.id);
        await supabaseAdmin.from("plm_sample_stages").insert({
          sample_request_id: other.id, product_id, factory_id: other.factory_id, user_id: user.id,
          stage: "killed",
          notes: `Disregard sample — production started with ${factoryName}`,
          updated_by: user.email, updated_by_role: "admin",
        });
      }
      // Update product to sample_approved
      await supabaseAdmin.from("plm_products").update({
        current_stage: "sample_approved",
        updated_at: new Date().toISOString(),
      }).eq("id", product_id);
      await supabaseAdmin.from("plm_stages").insert({
        product_id, user_id: user.id,
        stage: "sample_approved",
        notes: `Sample approved — ${factoryName} selected`,
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
    if (!(await checkPin(user.id, pin))) {
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
      progression: "Product set to Progression — moving forward",
      hold: "Product placed on Hold — paused but not cancelled",
      killed: "Product Killed — no longer moving forward",
    };
    await supabaseAdmin.from("plm_stages").insert({
      product_id, user_id: user.id,
      stage: `status_${status}`,
      notes: noteMap[status],
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
