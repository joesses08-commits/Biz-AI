import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPortalUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("factory_portal_users")
    .select("*")
    .eq("session_token", token)
    .eq("role", "designer")
    .single();
  if (!data) return null;
  if (new Date(data.session_expires_at) < new Date()) return null;
  return data;
}

export async function GET(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all products for this owner (Uncle David's account)
  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(current_stage)")
    .eq("user_id", portalUser.user_id)
    .order("created_at", { ascending: false });

  const { data: collections } = await supabaseAdmin
    .from("plm_collections")
    .select("id, name, season, year")
    .eq("user_id", portalUser.user_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ products: products || [], collections: collections || [] });
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "create_product") {
    const { name, sku, description, specs, category, collection_id, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_products").insert({
      user_id: portalUser.user_id,
      name, sku, description, specs, category,
      collection_id: collection_id || null,
      notes: notes || null,
      milestones: {},
      current_stage: "design_brief",
      stage_updated_at: new Date().toISOString(),
      submitted_by_designer: true,
      designer_name: portalUser.name || portalUser.email,
      approval_status: "pending",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, product: data });
  }

  if (body.action === "update_product") {
    const { id, name, sku, description, specs, category, collection_id, notes } = body;
    const { data: existing } = await supabaseAdmin
      .from("plm_products")
      .select("user_id")
      .eq("id", id)
      .single();
    if (!existing || existing.user_id !== portalUser.user_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await supabaseAdmin.from("plm_products").update({
      name, sku, description, specs, category,
      collection_id: collection_id || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "create_collection") {
    const { name, season, year, notes } = body;
    const { data, error } = await supabaseAdmin.from("plm_collections").insert({
      user_id: portalUser.user_id,
      name, season, year: year ? parseInt(year) : null, notes,
      status: "active",
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, collection: data });
  }

  if (body.action === "toggle_milestone") {
    const { product_id, milestone, value } = body;
    const { data: product } = await supabaseAdmin
      .from("plm_products")
      .select("milestones, user_id")
      .eq("id", product_id)
      .single();
    if (!product || product.user_id !== portalUser.user_id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const milestones = { ...(product.milestones || {}), [milestone]: value };
    await supabaseAdmin.from("plm_products").update({ milestones, updated_at: new Date().toISOString() }).eq("id", product_id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "submit_for_approval") {
    const { product_id } = body;
    const { data: product } = await supabaseAdmin
      .from("plm_products")
      .select("name, sku, user_id")
      .eq("id", product_id)
      .single();
    if (!product || product.user_id !== portalUser.user_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await supabaseAdmin.from("plm_products").update({
      approval_status: "pending_review",
      updated_at: new Date().toISOString(),
    }).eq("id", product_id);

    // Get owner email from Supabase Auth
    const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(portalUser.user_id);
    const ownerEmail = ownerUser?.email;

    if (ownerEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Jimmy AI <onboarding@resend.dev>",
          to: ownerEmail,
          subject: `Designer submitted ${product.name} for approval`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
              <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">Product Submitted for Approval</h2>
              <p style="color:#666;font-size:14px;margin-bottom:16px">
                <strong>${portalUser.name || portalUser.email}</strong> has submitted a product for your review.
              </p>
              <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px">
                <p style="margin:0 0 4px;font-size:14px"><strong>${product.name}</strong></p>
                ${product.sku ? `<p style="margin:0;font-size:12px;color:#888">SKU: ${product.sku}</p>` : ""}
              </div>
              <p style="font-size:13px;color:#666">Log into Jimmy AI to review and approve this product.</p>
              <a href="https://myjimmy.ai/plm/${product_id}?approve=1" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">Approve Product</a>
            </div>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
