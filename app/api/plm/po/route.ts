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

  const body = await req.json();
  const { action } = body;

  // ── SEND EMAIL ──
  if (action === "send_email") {
    const { factory, subject, body: emailBody, po_number, provider } = body;

    const { data: gmailConn } = await supabaseAdmin.from("gmail_connections").select("access_token,refresh_token").eq("user_id", user.id).single();
    const { data: msConn } = await supabaseAdmin.from("microsoft_connections").select("access_token").eq("user_id", user.id).single();

    const useGmail = provider === "gmail" || (!provider && gmailConn);
    const useOutlook = provider === "outlook" || (!provider && !gmailConn && msConn);

    if (useGmail && gmailConn) {
      const rawLines = [
        `To: ${factory?.email}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        emailBody,
      ];

      const encoded = Buffer.from(rawLines.join("\r\n")).toString("base64url");
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailConn.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });
    } else if (useOutlook && msConn) {
      await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${msConn.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "Text", content: emailBody },
            toRecipients: [{ emailAddress: { address: factory?.email } }],
          },
        }),
      });
    }

    return NextResponse.json({ success: true });
  }

  // ── GENERATE PO ──
  const { product_ids, line_items, factory_per_product, po_number, payment_terms, delivery_terms, ship_date, destination, notes, company_name, company_address, contact_name } = body;

  if (!product_ids?.length) return NextResponse.json({ error: "No products" }, { status: 400 });

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name), plm_sample_requests(status, factory_catalog(id, name, email, contact_name))")
    .in("id", product_ids)
    .eq("user_id", user.id);

  if (!products?.length) return NextResponse.json({ error: "Products not found" }, { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_name, full_name")
    .eq("user_id", user.id)
    .single();

  const { data: allFactories } = await supabaseAdmin.from("factory_catalog").select("*").eq("user_id", user.id);
  const factoryMap: Record<string, any> = {};
  (allFactories || []).forEach((f: any) => { factoryMap[f.id] = f; });

  const buyerCompany = company_name || profile?.company_name || "Your Company";
  const buyerContact = contact_name || profile?.full_name || "";
  const buyerAddress = company_address || "";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const shipDateStr = ship_date ? new Date(ship_date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "TBD";
  const poNum = po_number || "PO-" + Date.now().toString().slice(-6);

  // Get factory
  let factory: any = null;
  for (const p of products) {
    const overrideId = factory_per_product?.[p.id];
    if (overrideId && factoryMap[overrideId]) { factory = factoryMap[overrideId]; break; }
    const req = (p.plm_sample_requests || []).find((r: any) => r.status === "approved");
    if (req?.factory_catalog) { factory = req.factory_catalog; break; }
  }

  // Build product rows
  let productRows = "";
  let totalValue = 0;
  const lineItemsSummary: string[] = [];

  for (const p of products) {
    const line = line_items?.[p.id] || {};
    const qty = parseFloat(line.qty) || 0;
    const unitPrice = parseFloat(line.unit_price) || 0;
    const total = qty && unitPrice ? qty * unitPrice : 0;
    if (total) totalValue += total;
    if (qty) lineItemsSummary.push(`${p.name} x${qty}`);

    productRows += `
      <tr>
        <td>${p.name}${p.specs ? `<br><span style="font-size:10px;color:#666">${p.specs}</span>` : ""}</td>
        <td style="text-align:center">${p.sku || "—"}</td>
        <td style="text-align:center">${qty || "TBD"}</td>
        <td style="text-align:right">${unitPrice ? "$" + unitPrice.toFixed(2) : "TBD"}</td>
        <td style="text-align:right;font-weight:600">${total ? "$" + total.toFixed(2) : "TBD"}</td>
      </tr>`;
  }

  // Create batches for each product
  for (const p of products) {
    const overrideId = factory_per_product?.[p.id];
    const factoryId = overrideId || (p.plm_sample_requests || []).find((r: any) => r.status === "approved")?.factory_catalog?.id;
    const line = line_items?.[p.id] || {};
    const qty = parseFloat(line.qty) || null;
    const unitPrice = parseFloat(line.unit_price) || null;

    const { data: existing } = await supabaseAdmin.from("plm_batches").select("batch_number").eq("product_id", p.id).order("batch_number", { ascending: false }).limit(1);
    const nextBatch = (existing?.[0]?.batch_number || 0) + 1;

    const { data: batch } = await supabaseAdmin.from("plm_batches").insert({
      product_id: p.id,
      user_id: user.id,
      batch_number: nextBatch,
      factory_id: factoryId || null,
      current_stage: "po_issued",
      linked_po_number: poNum,
      order_quantity: qty,
      target_elc: unitPrice,
      target_sell_price: null,
      batch_notes: notes || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (batch) {
      await supabaseAdmin.from("plm_batch_stages").insert({
        batch_id: batch.id,
        product_id: p.id,
        user_id: user.id,
        stage: "po_issued",
        notes: `PO ${poNum} issued`,
        updated_by: user.email,
        updated_by_role: "admin",
        created_at: new Date().toISOString(),
      });
    }
  }

  // Build email body
  const email_body = `Dear ${factory?.contact_name || factory?.name || "Team"},

Please find below a link to Purchase Order ${poNum} for the following items:

${lineItemsSummary.map(s => `• ${s}`).join("\n")}

${totalValue > 0 ? `Total Order Value: $${totalValue.toFixed(2)}` : ""}

Payment Terms: ${payment_terms || "TBD"}
Delivery Terms: ${delivery_terms || "FOB Factory"}
Requested Ship Date: ${shipDateStr}
${destination ? `Ship To: ${destination}` : ""}
${notes ? `\nNotes: ${notes}` : ""}

Please review and confirm receipt of this PO. Sign and return a copy to acknowledge acceptance.

Best regards,
${buyerContact || buyerCompany}`;

  // Check email providers
  const { data: gmailConn } = await supabaseAdmin.from("gmail_connections").select("id, access_token").eq("user_id", user.id).single();
  const { data: msConn } = await supabaseAdmin.from("microsoft_connections").select("id").eq("user_id", user.id).single();
  const both_connected = !!gmailConn && !!msConn;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Purchase Order ${poNum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 48px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #1a1a1a; }
  .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .po-label { text-align: right; }
  .po-label h1 { font-size: 26px; font-weight: 900; color: #1a1a1a; }
  .po-label .po-num { font-size: 13px; color: #555; margin-top: 2px; }
  .po-label .po-date { font-size: 11px; color: #888; margin-top: 2px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; }
  .party h3 { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; }
  .party .name { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
  .party p { font-size: 11px; color: #555; margin-bottom: 2px; }
  .terms { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; background: #f5f5f5; padding: 16px; border-radius: 6px; margin-bottom: 28px; }
  .term label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; margin-bottom: 4px; }
  .term span { font-size: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1a1a1a; }
  thead th { color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
  thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }
  tbody td { padding: 11px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  .total-row td { padding: 13px 12px; background: #f5f5f5; font-size: 13px; font-weight: 700; border-top: 2px solid #1a1a1a; }
  .notes { background: #fffbeb; border: 1px solid #f0e0a0; padding: 14px; border-radius: 6px; margin-bottom: 28px; }
  .notes label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; margin-bottom: 6px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; }
  .sig-block { border-top: 1px solid #bbb; padding-top: 8px; }
  .sig-block .sig-name { font-weight: 600; font-size: 11px; }
  .sig-block .sig-label { font-size: 10px; color: #888; }
  .sig-date { border-top: 1px solid #bbb; padding-top: 8px; margin-top: 20px; font-size: 10px; color: #888; }
  .footer-note { margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">${buyerCompany}</div>
      ${buyerContact ? `<div style="color:#555;font-size:12px;margin-top:3px">${buyerContact}</div>` : ""}
      ${buyerAddress ? `<div style="color:#888;font-size:11px;margin-top:2px">${buyerAddress}</div>` : ""}
    </div>
    <div class="po-label">
      <h1>PURCHASE ORDER</h1>
      <div class="po-num">${poNum}</div>
      <div class="po-date">${dateStr}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>Bill From / Buyer</h3>
      <div class="name">${buyerCompany}</div>
      ${buyerContact ? `<p>${buyerContact}</p>` : ""}
      ${buyerAddress ? `<p>${buyerAddress}</p>` : ""}
    </div>
    <div class="party">
      <h3>Sell To / Factory</h3>
      <div class="name">${factory?.name || "Factory"}</div>
      ${factory?.contact_name ? `<p>${factory.contact_name}</p>` : ""}
      ${factory?.email ? `<p>${factory.email}</p>` : ""}
    </div>
  </div>
  <div class="terms">
    <div class="term"><label>PO Number</label><span>${poNum}</span></div>
    <div class="term"><label>Payment Terms</label><span>${payment_terms || "TBD"}</span></div>
    <div class="term"><label>Delivery Terms</label><span>${delivery_terms || "FOB Factory"}</span></div>
    <div class="term"><label>Requested Ship Date</label><span>${shipDateStr}</span></div>
  </div>
  ${destination ? `<div style="margin-bottom:20px;padding:12px 16px;background:#f5f5f5;border-radius:6px"><label style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:4px">Ship To / Destination</label><span style="font-weight:600">${destination}</span></div>` : ""}
  <table>
    <thead>
      <tr>
        <th style="width:40%">Product / Description</th>
        <th style="width:12%;text-align:center">SKU</th>
        <th style="width:12%;text-align:center">Quantity</th>
        <th style="width:16%;text-align:right">Unit Price</th>
        <th style="width:20%;text-align:right">Total</th>
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
  ${notes ? `<div class="notes"><label>Notes & Special Instructions</label><p style="font-size:12px">${notes}</p></div>` : ""}
  <div class="signatures">
    <div>
      <div class="sig-block"><div class="sig-name">${buyerContact || buyerCompany}</div><div class="sig-label">Authorized Signature — Buyer</div></div>
      <div class="sig-date">Date: ___________________________</div>
    </div>
    <div>
      <div class="sig-block"><div class="sig-name">${factory?.name || "Factory"}</div><div class="sig-label">Authorized Signature — Factory</div></div>
      <div class="sig-date">Date: ___________________________</div>
    </div>
  </div>
  <div class="footer-note">This Purchase Order is a binding agreement between ${buyerCompany} and ${factory?.name || "the factory"} upon factory acknowledgment and signature. Please sign and return a copy to confirm acceptance.</div>
</body>
</html>`;

  await supabaseAdmin.from("company_events").insert({
    user_id: user.id, source: "PLM", event_type: "po_generated",
    title: `PO ${poNum} generated for ${products.length} products`,
    summary: `Purchase order ${poNum} issued. Total: ${totalValue > 0 ? "$" + totalValue.toFixed(2) : "TBD"}`,
    importance: "high",
    raw_data: { po_number: poNum, product_ids, payment_terms, delivery_terms, ship_date, destination, total: totalValue },
    created_at: new Date().toISOString(),
  });

  await supabaseAdmin.from("po_history").insert({
    user_id: user.id,
    po_number: poNum,
    product_ids: product_ids,
    product_count: products.length,
    total_value: totalValue > 0 ? totalValue : null,
    factory_name: factory?.name || null,
    factory_email: factory?.email || null,
    payment_terms: payment_terms || null,
    delivery_terms: delivery_terms || null,
    ship_date: ship_date || null,
    destination: destination || null,
    notes: notes || null,
    html_content: html,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, html, po_number: poNum, factory, email_body, both_connected });
}
