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

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_ids, po_number, payment_terms, delivery_terms, ship_date, destination, notes } = await req.json();

  if (!product_ids?.length) return NextResponse.json({ error: "No products" }, { status: 400 });

  // Fetch products with approved sample requests
  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name), plm_sample_requests(status, factory_id, factory_catalog(name, email, contact_name)), plm_batches(target_elc, target_sell_price, order_quantity, moq)")
    .in("id", product_ids)
    .eq("user_id", user.id);

  if (!products?.length) return NextResponse.json({ error: "Products not found" }, { status: 404 });

  // Get company profile
  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_name, full_name")
    .eq("user_id", user.id)
    .single();

  // Group products by factory
  const byFactory: Record<string, { factory: any; products: any[] }> = {};
  
  for (const product of products) {
    const approvedReq = (product.plm_sample_requests || []).find((r: any) => r.status === "approved");
    const factory = approvedReq?.factory_catalog;
    const factoryKey = factory?.name || "Unknown Factory";
    if (!byFactory[factoryKey]) byFactory[factoryKey] = { factory, products: [] };
    byFactory[factoryKey].products.push(product);
  }

  // Generate PDF using HTML template (we'll use a simple HTML approach)
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const shipDateStr = ship_date ? new Date(ship_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "TBD";

  // Build HTML for PDF
  const factoryEntries = Object.entries(byFactory);
  
  let productRows = "";
  let totalValue = 0;
  
  for (const [factoryName, { factory, products: factoryProducts }] of factoryEntries) {
    for (const p of factoryProducts) {
      const batch = p.plm_batches?.[0];
      const qty = batch?.order_quantity || batch?.moq || "";
      const unitPrice = batch?.target_elc || "";
      const total = qty && unitPrice ? (qty * unitPrice).toFixed(2) : "";
      if (total) totalValue += parseFloat(total);
      
      productRows += `
        <tr>
          <td>${p.name}</td>
          <td>${p.sku || ""}</td>
          <td style="text-align:center">${qty || "TBD"}</td>
          <td style="text-align:right">${unitPrice ? "$" + Number(unitPrice).toFixed(2) : "TBD"}</td>
          <td style="text-align:right">${total ? "$" + Number(total).toFixed(2) : "TBD"}</td>
        </tr>`;
    }
  }

  const firstFactory = factoryEntries[0]?.[1]?.factory;
  const companyName = profile?.company_name || "Jimmy AI";
  const contactName = profile?.full_name || "";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; }
  .company-name { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .po-title { text-align: right; }
  .po-title h1 { font-size: 28px; font-weight: 800; color: #1a1a1a; margin: 0; }
  .po-number { font-size: 14px; color: #666; margin-top: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0; }
  .info-box p { margin: 2px 0; font-size: 12px; }
  .info-box .name { font-weight: 700; font-size: 14px; }
  .details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; background: #f8f8f8; padding: 16px; border-radius: 8px; }
  .detail-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; margin-bottom: 4px; }
  .detail-item span { font-weight: 600; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #1a1a1a; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: center; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
  tr:last-child td { border-bottom: 2px solid #1a1a1a; }
  .total-row { font-weight: 700; background: #f8f8f8; }
  .total-row td { padding: 12px; font-size: 14px; }
  .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1px solid #ccc; padding-top: 8px; margin-top: 40px; font-size: 11px; color: #666; }
  .notes-box { background: #f8f8f8; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
  .notes-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 8px 0; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${companyName}</div>
      ${contactName ? `<div style="color:#666;margin-top:4px">${contactName}</div>` : ""}
    </div>
    <div class="po-title">
      <h1>PURCHASE ORDER</h1>
      <div class="po-number">${po_number || "PO-" + Date.now().toString().slice(-6)}</div>
      <div style="color:#666;font-size:11px;margin-top:4px">${dateStr}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>From (Buyer)</h3>
      <p class="name">${companyName}</p>
      ${contactName ? `<p>${contactName}</p>` : ""}
    </div>
    <div class="info-box">
      <h3>To (Factory)</h3>
      <p class="name">${firstFactory?.name || "Factory"}</p>
      ${firstFactory?.contact_name ? `<p>${firstFactory.contact_name}</p>` : ""}
      ${firstFactory?.email ? `<p>${firstFactory.email}</p>` : ""}
    </div>
  </div>

  <div class="details-grid">
    <div class="detail-item">
      <label>Payment Terms</label>
      <span>${payment_terms || "TBD"}</span>
    </div>
    <div class="detail-item">
      <label>Delivery Terms</label>
      <span>${delivery_terms || "FOB Factory"}</span>
    </div>
    <div class="detail-item">
      <label>Ship Date</label>
      <span>${shipDateStr}</span>
    </div>
    <div class="detail-item">
      <label>Ship To</label>
      <span>${destination || "TBD"}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product Name</th>
        <th>SKU</th>
        <th style="text-align:center">Quantity</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${productRows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">TOTAL ORDER VALUE</td>
        <td style="text-align:right">${totalValue > 0 ? "$" + totalValue.toFixed(2) : "TBD"}</td>
      </tr>
    </tbody>
  </table>

  ${notes ? `<div class="notes-box"><h3>Notes & Special Instructions</h3><p>${notes}</p></div>` : ""}

  <div class="footer">
    <div>
      <div class="sig-line">Authorized Signature</div>
      <div class="sig-line" style="margin-top:20px">Date</div>
    </div>
    <div>
      <div class="sig-line">Factory Acknowledgment</div>
      <div class="sig-line" style="margin-top:20px">Date</div>
    </div>
  </div>

  <div style="margin-top:40px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px">
    This Purchase Order constitutes a binding agreement between ${companyName} and the factory upon factory acknowledgment. 
    Please sign and return a copy to confirm acceptance.
  </div>
</body>
</html>`;

  // Convert HTML to PDF using puppeteer-core or return HTML for client-side PDF
  // We'll return the HTML as base64 and use browser print for now
  // Actually, use the html-pdf approach via a script
  
  // Store PO record
  await supabaseAdmin.from("company_events").insert({
    user_id: user.id,
    source: "PLM",
    event_type: "po_generated",
    title: `PO ${po_number} generated for ${products.length} products`,
    summary: `Purchase order generated for ${products.map((p: any) => p.name).join(", ")}`,
    importance: "high",
    raw_data: { po_number, product_ids, payment_terms, delivery_terms, ship_date, destination },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, html, po_number });
}
