import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { trackUsage } from "@/lib/track-usage";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function getUser(req?: NextRequest) {
  // Allow internal calls from push handlers
  if (req) {
    const secret = req.headers.get("x-internal-secret");
    const userId = req.headers.get("x-user-id");
    if (secret === process.env.CRON_SECRET && userId) {
      return { id: userId } as any;
    }
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function refreshGmailToken(conn: any, userId: string) {
  if (new Date(conn.token_expiry) > new Date()) return conn.access_token;
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await refreshRes.json();
  if (data.access_token) {
    await supabaseAdmin.from("gmail_connections").update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", userId);
    return data.access_token;
  }
  return conn.access_token;
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: jobs } = await supabaseAdmin
      .from("factory_quote_jobs")
      .select("*, factory_quotes(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ jobs: jobs || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── CREATE JOB ──────────────────────────────────────────────────────
    if (action === "create_job") {
      const { job_name, factories, order_details, product_file_base64, product_file_name } = body;
      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .insert({
          user_id: user.id,
          job_name,
          factories,
          order_details,
          product_file_base64: product_file_base64 || null,
          product_file_name: product_file_name || null,
          status: "waiting",
        })
        .select()
        .single();
      return NextResponse.json({ success: true, job });
    }

    // ── SEND RFQ EMAILS WITH FILE ATTACHMENT ─────────────────────────────
    if (action === "send_rfq") {
      const { job_id } = body;

      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      if (!job.product_file_base64) return NextResponse.json({ error: "No product file attached to this job" }, { status: 400 });

      // Use whichever email provider is connected — Gmail takes priority
      const { data: gmailConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: msConn } = await supabaseAdmin
        .from("microsoft_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!gmailConn?.access_token && !msConn?.access_token) {
        return NextResponse.json({ error: "No email provider connected. Connect Gmail or Outlook first." }, { status: 400 });
      }

      // If both connected, frontend must specify provider
      const bothConnected = !!gmailConn?.access_token && !!msConn?.access_token;
      if (bothConnected && !body.provider) {
        return NextResponse.json({ error: "both_connected", gmailEmail: gmailConn.email, outlookEmail: msConn.email }, { status: 400 });
      }

      // check_only — just verify provider, don't send
      if (body.check_only) {
        return NextResponse.json({ success: true, provider: body.provider || "gmail" });
      }

      const useGmail = body.provider === "outlook" ? false : !!gmailConn?.access_token;
      const results: { factory: string; success: boolean; error?: string }[] = [];
      const customBody = body.custom_body || null;

      // Get user's name for sign-off
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const senderName = userProfile?.full_name || "Joey";

      const fileBase64 = job.product_file_base64.replace(/-/g, "+").replace(/_/g, "/");
      const fileName = job.product_file_name || "Product List.xlsx";
      const boundary = "boundary_" + Date.now();

      // Gmail send
      if (useGmail) {
        const accessToken = await refreshGmailToken(gmailConn, user.id);

        for (const factory of (job.factories || [])) {
          try {
            const contactName = factory.contact_name || factory.name;
            const emailBody = customBody
              ? customBody.replace("[contact name]", contactName).replace("[your name]", senderName)
              : `Hi ${contactName},

Hope you're doing well! Please find attached our product list for the ${job.job_name}.

Could you fill in your pricing in the attached file and reply to this email with the completed sheet? We're looking for unit price, MOQ, lead time, and payment terms — but just fill in whatever applies.

Thanks so much,
${senderName}`;

            const mime = [
              `MIME-Version: 1.0`,
              `To: ${factory.email}`,
              `Subject: RFQ: ${job.job_name} - Please Quote Attached Product List`,
              `Content-Type: multipart/mixed; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/plain; charset=utf-8`,
              ``,
              emailBody,
              ``,
              `--${boundary}`,
              `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
              `Content-Transfer-Encoding: base64`,
              `Content-Disposition: attachment; filename="${fileName}"`,
              ``,
              fileBase64,
              ``,
              `--${boundary}--`,
            ].join("\r\n");

            const encoded = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

            const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ raw: encoded }),
            });

            const sendData = await sendRes.json();
            results.push({ factory: factory.name, success: !!sendData.id, error: sendData.error?.message });
          } catch (err) {
            results.push({ factory: factory.name, success: false, error: String(err) });
          }
        }
      } else {
        // Outlook send via Microsoft Graph
        let accessToken = msConn.access_token;
        if (new Date(msConn.expires_at) < new Date()) {
          const refreshRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: msConn.refresh_token,
              client_id: process.env.MICROSOFT_CLIENT_ID!,
              client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
              grant_type: "refresh_token",
              scope: "Mail.Read Mail.Send Files.ReadWrite offline_access",
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            await supabaseAdmin.from("microsoft_connections").update({
              access_token: accessToken,
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            }).eq("user_id", user.id);
          }
        }

        for (const factory of (job.factories || [])) {
          try {
            const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                message: {
                  subject: `RFQ: ${job.job_name} - Please Quote Attached Product List`,
                  body: {
                    contentType: "Text",
                    content: `Hi ${factory.contact_name || factory.name},

Hope you're doing well! Please find attached our product list for the ${job.job_name}.

Could you fill in your pricing in the attached file and reply to this email with the completed sheet? We're looking for unit price, MOQ, lead time, and payment terms — but just fill in whatever applies.

Thanks so much,
${senderName}`,
                  },
                  toRecipients: [{ emailAddress: { address: factory.email } }],
                  attachments: [{
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    name: fileName,
                    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    contentBytes: fileBase64,
                  }],
                },
              }),
            });

            results.push({ factory: factory.name, success: sendRes.status === 202, error: sendRes.status !== 202 ? "Send failed" : undefined });
          } catch (err) {
            results.push({ factory: factory.name, success: false, error: String(err) });
          }
        }
      }

      await supabaseAdmin.from("factory_quote_jobs").update({
        status: "rfq_sent",
        rfq_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      // Update PLM products to artwork_sent if this job came from PLM
      const orderDetails = job.order_details as any;
      const plmProductIds = orderDetails?.plm_product_ids || [];
      if (plmProductIds.length > 0) {
        const factoryNames = (job.factories || []).map((f: any) => f.name).join(", ");
        const noteEntry = `Artwork Sent: RFQ sent to ${factoryNames}`;
        for (const productId of plmProductIds) {
          const { data: product } = await supabaseAdmin
            .from("plm_products")
            .select("notes, current_stage")
            .eq("id", productId)
            .single();
          if (product) {
            const updatedNotes = product.notes ? `${product.notes}
${noteEntry}` : noteEntry;
            await supabaseAdmin.from("plm_products").update({
              current_stage: "artwork_sent",
              notes: updatedNotes,
              updated_at: new Date().toISOString(),
            }).eq("id", productId);
            // Log to history
            await supabaseAdmin.from("plm_stages").insert({
              product_id: productId,
              user_id: user.id,
              stage: "artwork_sent",
              notes: `RFQ sent to ${factoryNames}`,
              updated_by: user.email || "jimmy",
              updated_by_role: "admin",
            });
          }
        }
      }

      return NextResponse.json({ success: true, results, provider: useGmail ? "gmail" : "outlook" });
    }

    // ── PROCESS RETURNED QUOTE FILE ──────────────────────────────────────
    if (action === "process_file") {
      const { job_id, factory_name, factory_email, file_base64, file_name } = body;

      const buffer = Buffer.from(file_base64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      let allData = "";
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        allData += `\nSHEET: ${sheetName}\n${csv}\n`;
      }

      // Extract images
      const imagesByRow: Record<number, string> = {};
      try {
        const zip = await JSZip.loadAsync(buffer);
        const mediaEntries: { name: string; data: string }[] = [];
        for (const [path, file] of Object.entries(zip.files)) {
          if (path.startsWith("xl/media/") && !(file as any).dir) {
            const imgBuffer = await (file as any).async("base64");
            const ext = path.split(".").pop() || "png";
            mediaEntries.push({ name: path.split("/").pop() || "", data: `data:image/${ext};base64,${imgBuffer}` });
          }
        }
        mediaEntries.sort((a, b) => (parseInt(a.name.replace(/\D/g, "")) || 0) - (parseInt(b.name.replace(/\D/g, "")) || 0));
        mediaEntries.forEach((entry, i) => { imagesByRow[i + 1] = entry.data; });
      } catch {}

      // Extract products + pricing from the returned file
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: `Extract all products and their pricing from this factory quote file. The factory has filled in their prices.
Return ONLY raw JSON, no markdown:
{
  "factory_name": "name of factory if found",
  "products": [
    {
      "product_name": "product name/description",
      "specs": "material, size, color, etc",
      "sku": "SKU or product code if any",
      "unit_cost": 0.00,
      "currency": "USD",
      "moq": 0,
      "lead_time_days": 0,
      "notes": "any additional info"
    }
  ]
}`,
        messages: [{ role: "user", content: `Extract products and pricing:\n${allData.slice(0, 8000)}` }],
      });

      trackUsage(user.id, "factory-quote-extraction", "claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
      const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

      const { data: jobRow } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("order_details, factories")
        .eq("id", job_id)
        .single();

      const orderDetails = jobRow?.order_details || {};
      const dutyPct = parseFloat(orderDetails.duty_pct || "30") / 100;
      const tariffPct = parseFloat(orderDetails.tariff_pct || "20") / 100;
      const freight = parseFloat(orderDetails.freight || "0.15");

      const processedProducts = (parsed.products || []).map((p: any) => {
        const firstCost = parseFloat(p.unit_cost) || 0;
        const elc = firstCost * (1 + dutyPct) * (1 + tariffPct) + freight;
        return {
          ...p,
          factory_name: factory_name.replace(/_Quote_with_Images$/i, "").replace(/_Quote$/i, "").replace(/ Quote.*$/i, "").replace(/_/g, " ").trim(),
          factory_email,
          first_cost: firstCost,
          duty_pct: orderDetails.duty_pct || "30",
          tariff_pct: orderDetails.tariff_pct || "20",
          freight,
          elc: Math.round(elc * 100) / 100,
        };
      });

      await supabaseAdmin.from("factory_quotes").insert({
        job_id,
        user_id: user.id,
        factory_name,
        factory_email,
        attachment_name: file_name,
        raw_data: parsed.products || [],
        processed_data: processedProducts,
        raw_file_base64: file_base64.slice(0, 500000) || null,
        status: "processed",
      });

      const { data: allQuotes } = await supabaseAdmin.from("factory_quotes").select("id").eq("job_id", job_id);
      const totalFactories = (jobRow?.factories || []).length;
      const receivedCount = allQuotes?.length || 0;
      const newStatus = receivedCount >= totalFactories ? "ready" : "rfq_sent";

      await supabaseAdmin.from("factory_quote_jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job_id);

      // Auto-build when all quotes in
      if (newStatus === "ready") {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/factory-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "build_master", job_id, _internal: true }),
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, products: processedProducts, status: newStatus });
    }

    // ── BUILD MASTER SHEET ───────────────────────────────────────────────
    if (action === "build_master") {
      const { job_id } = body;

      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("*, factory_quotes(*)")
        .eq("id", job_id)
        .single();

      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const allProducts: any[] = [];
      for (const quote of (job.factory_quotes || [])) {
        const quoteImages: Record<number, string> = {};
        if (quote.raw_file_base64) {
          try {
            const zip = await JSZip.loadAsync(Buffer.from(quote.raw_file_base64, "base64"));
            const mediaEntries: { name: string; data: string }[] = [];
            for (const [path, file] of Object.entries(zip.files)) {
              if (path.startsWith("xl/media/") && !(file as any).dir) {
                const imgBuffer = await (file as any).async("base64");
                const ext = path.split(".").pop() || "png";
                mediaEntries.push({ name: path.split("/").pop() || "", data: `data:image/${ext};base64,${imgBuffer}` });
              }
            }
            mediaEntries.sort((a, b) => (parseInt(a.name.replace(/\D/g, "")) || 0) - (parseInt(b.name.replace(/\D/g, "")) || 0));
            mediaEntries.forEach((entry, i) => { quoteImages[i + 1] = entry.data; });
          } catch {}
        }
        for (let i = 0; i < (quote.processed_data || []).length; i++) {
          allProducts.push({ ...quote.processed_data[i], image_base64: quoteImages[i + 1] || null });
        }
      }

      // Group by product, sort by ELC
      const productGroups: Record<string, any[]> = {};
      for (const p of allProducts) {
        const key = p.product_name || "Unknown";
        if (!productGroups[key]) productGroups[key] = [];
        productGroups[key].push(p);
      }
      for (const key of Object.keys(productGroups)) {
        productGroups[key].sort((a, b) => a.elc - b.elc);
      }

      // Run AI recommendation
      const productSummary = Object.entries(productGroups).map(([name, factories]) => {
        const best = factories[0];
        const second = factories[1];
        return `${name}: Best=${best.factory_name} ELC=$${best.elc}${second ? ` | 2nd=${second.factory_name} ELC=$${second.elc} (save $${Math.round((second.elc - best.elc) * 100) / 100})` : ""}`;
      }).join("\n");

      const aiRes = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: "You are a procurement advisor. Give a concise recommendation based on factory quote comparison data. Be direct and actionable. 3-5 sentences max.",
        messages: [{ role: "user", content: `Quote comparison for "${job.job_name}":\n${productSummary}\n\nGive your recommendation.` }],
      });
      trackUsage(user.id, "factory-quote-recommendation", "claude-haiku-4-5-20251001", aiRes.usage.input_tokens, aiRes.usage.output_tokens).catch(() => {});
      const aiRecommendation = aiRes.content[0].type === "text" ? aiRes.content[0].text : "";

      // Build Excel
      const wb = new ExcelJS.Workbook();
      wb.creator = "Jimmy AI";

      const ws = wb.addWorksheet("Quote Comparison");
      ws.columns = [
        { header: "Photo/SKU", key: "sku", width: 14 },
        { header: "Product", key: "product", width: 30 },
        { header: "Specs", key: "specs", width: 32 },
        { header: "Factory", key: "factory", width: 22 },
        { header: "First Cost", key: "first_cost", width: 12 },
        { header: "Duty%", key: "duty", width: 8 },
        { header: "Tariff%", key: "tariff", width: 8 },
        { header: "Freight", key: "freight", width: 10 },
        { header: "ELC", key: "elc", width: 10 },
        { header: "Sell Price (fill in)", key: "sell", width: 18 },
        { header: "Margin%", key: "margin", width: 10 },
        { header: "MOQ", key: "moq", width: 8 },
        { header: "Lead Time (days)", key: "lead", width: 16 },
        { header: "Competitiveness", key: "comp", width: 22 },
        { header: "Notes", key: "notes", width: 28 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { bottom: { style: "thin", color: { argb: "FF444444" } } };
      });
      headerRow.height = 20;

      for (const [productName, factories] of Object.entries(productGroups)) {
        factories.forEach((f: any, index: number) => {
          const comp = index === 0 ? "🥇 Most Competitive" : index === 1 ? "🥈 2nd Best" : index === 2 ? "🥉 3rd Best" : `${index + 1}th`;
          const row = ws.addRow({
            sku: index === 0 ? (f.sku || "") : "",
            product: index === 0 ? productName : "",
            specs: index === 0 ? f.specs : "",
            factory: f.factory_name,
            first_cost: f.first_cost,
            duty: `${f.duty_pct}%`,
            tariff: `${f.tariff_pct}%`,
            freight: f.freight,
            elc: f.elc,
            sell: "",
            margin: "",
            moq: f.moq || "",
            lead: f.lead_time_days || "",
            comp,
            notes: f.notes || "",
          });

          const rowNum = row.number;
          const sellCell = row.getCell("sell");
          sellCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFACD" } };
          sellCell.note = "Enter your sell price here";
          row.getCell("margin").value = { formula: `=IF(J${rowNum}="","",((J${rowNum}-I${rowNum})/J${rowNum}))` };
          row.getCell("margin").numFmt = "0.00%";

          if (index === 0 && f.image_base64) {
            try {
              const imageData = f.image_base64.split(",")[1] || f.image_base64;
              const ext = f.image_base64.includes("png") ? "png" : "jpeg";
              const imageId = wb.addImage({ base64: imageData, extension: ext as "png" | "jpeg" });
              ws.addImage(imageId, { tl: { col: 0, row: rowNum - 1 }, ext: { width: 80, height: 60 }, editAs: "oneCell" });
              row.height = 60;
            } catch {}
          }

          if (index === 0) {
            row.eachCell(cell => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
              cell.font = { bold: true, size: 10 };
            });
            sellCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFACD" } };
          }
          if (!f.image_base64 || index !== 0) row.height = 18;
        });
        ws.addRow({});
      }
      ws.views = [{ state: "frozen", ySplit: 1 }];

      // Summary sheet
      const summaryWs = wb.addWorksheet("Summary");
      summaryWs.columns = [
        { header: "Product", key: "product", width: 32 },
        { header: "Best Factory", key: "factory", width: 22 },
        { header: "Best ELC", key: "elc", width: 12 },
        { header: "Savings vs 2nd Best", key: "savings", width: 38 },
        { header: "2nd Best Factory", key: "second", width: 22 },
        { header: "2nd Best ELC", key: "second_elc", width: 14 },
        { header: "Negotiation Target", key: "target", width: 30 },
      ];
      const summaryHeader = summaryWs.getRow(1);
      summaryHeader.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      summaryHeader.height = 20;

      for (const [productName, factories] of Object.entries(productGroups)) {
        const best = factories[0];
        const second = factories[1] || null;
        const savings = second ? Math.round((second.elc - best.elc) * 100) / 100 : 0;
        const row = summaryWs.addRow({
          product: productName,
          factory: best.factory_name,
          elc: best.elc,
          savings: second ? (savings > 0 ? `$${savings} cheaper than ${second.factory_name}` : "Same price") : "No comparison",
          second: second?.factory_name || "—",
          second_elc: second?.elc || "—",
          target: second ? `Ask ${second.factory_name} to match $${best.first_cost}/unit` : "Only one quote",
        });
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
        });
        row.height = 18;
      }

      // AI Recommendation sheet
      const recWs = wb.addWorksheet("AI Recommendation");
      recWs.getColumn(1).width = 100;
      const titleCell = recWs.getCell("A1");
      titleCell.value = "Jimmy AI – Procurement Recommendation";
      titleCell.font = { bold: true, size: 14, color: { argb: "FF1a1a2e" } };
      recWs.getRow(1).height = 24;
      recWs.getCell("A2").value = `Job: ${job.job_name}`;
      recWs.getCell("A2").font = { size: 11, color: { argb: "FF666666" } };
      recWs.getCell("A3").value = `Generated: ${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" })}`;
      recWs.getCell("A3").font = { size: 10, color: { argb: "FF999999" } };
      recWs.getCell("A5").value = aiRecommendation;
      recWs.getCell("A5").font = { size: 11 };
      recWs.getCell("A5").alignment = { wrapText: true };
      recWs.getRow(5).height = 120;
      summaryWs.views = [{ state: "frozen", ySplit: 1 }];

      const excelBuffer = await wb.xlsx.writeBuffer();
      const base64 = Buffer.from(excelBuffer).toString("base64");
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
      const fileName = `${date} Factory Quote Comparison — ${job.job_name}.xlsx`;

      // Upload to Google Drive
      const { data: gmailConn } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", job.user_id).single();
      let sheetUrl = null;
      if (gmailConn?.access_token) {
        try {
          const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
            method: "POST",
            headers: { Authorization: `Bearer ${gmailConn.access_token}`, "Content-Type": "multipart/related; boundary=boundary" },
            body: [
              "--boundary", "Content-Type: application/json", "",
              JSON.stringify({ name: fileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
              "--boundary", "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Transfer-Encoding: base64", "", base64, "--boundary--",
            ].join("\r\n"),
          });
          const uploadData = await uploadRes.json();
          if (uploadData.id) sheetUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
        } catch {}
      }

      await supabaseAdmin.from("factory_quote_jobs").update({
        status: "complete",
        master_sheet_url: sheetUrl,
        ai_recommendation: aiRecommendation,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      // Update PLM products to quotes_received with per-product factory data
      const buildJob = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("order_details, factory_quotes(factory_name, processed_data)")
        .eq("id", job_id)
        .single();
      const buildOrderDetails = buildJob.data?.order_details as any;
      const buildPlmIds = buildOrderDetails?.plm_product_ids || [];
      const allFactoryQuotes = buildJob.data?.factory_quotes || [];

      if (buildPlmIds.length > 0) {
        // Get PLM product names to match against factory quote rows
        const { data: plmProducts } = await supabaseAdmin
          .from("plm_products")
          .select("id, name, sku, notes")
          .in("id", buildPlmIds);

        for (const plmProduct of (plmProducts || [])) {
          // For each factory, find the row matching this product by name or SKU
          const factoryLines: string[] = [];
          for (const fq of allFactoryQuotes) {
            const rows = (fq.processed_data || []) as any[];
            const match = rows.find((r: any) =>
              r.name?.toLowerCase().includes(plmProduct.name?.toLowerCase().slice(0, 8)) ||
              r.sku?.toLowerCase() === plmProduct.sku?.toLowerCase()
            ) || rows[0]; // fallback to first row if only 1 product
            if (match) {
              const price = match.first_cost ? `$${match.first_cost}` : match.unit_cost ? `$${match.unit_cost}` : "N/A";
              const moq = match.moq ? `MOQ ${match.moq}` : null;
              const lead = match.lead_time_days ? `${match.lead_time_days}d lead` : null;
              const elc = match.elc ? `ELC $${match.elc}` : null;
              const parts = [price, moq, lead, elc].filter(Boolean).join(", ");
              factoryLines.push(`${fq.factory_name}: ${parts}`);
            }
          }

          const noteEntry = `Quotes Received:
${factoryLines.join("
")}`;
          const updatedNotes = plmProduct.notes ? `${plmProduct.notes}
${noteEntry}` : noteEntry;

          await supabaseAdmin.from("plm_products").update({
            current_stage: "quotes_received",
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          }).eq("id", plmProduct.id);

          await supabaseAdmin.from("plm_stages").insert({
            product_id: plmProduct.id,
            user_id: user.id,
            stage: "quotes_received",
            notes: factoryLines.join(" | "),
            updated_by: user.email || "jimmy",
            updated_by_role: "admin",
          });
        }
      }

      return NextResponse.json({ success: true, fileName, sheetUrl, base64, aiRecommendation });
    }

    // ── DELETE JOBS ─────────────────────────────────────────────────────
    if (action === "delete_jobs") {
      const { job_ids } = body;
      if (!job_ids?.length) return NextResponse.json({ error: "No job IDs" }, { status: 400 });
      await supabaseAdmin.from("factory_quotes").delete().in("job_id", job_ids);
      await supabaseAdmin.from("factory_quote_jobs").delete().in("id", job_ids).eq("user_id", user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
