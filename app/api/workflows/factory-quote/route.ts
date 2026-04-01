import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── CREATE JOB ──────────────────────────────────────────────────────
    if (action === "create_job") {
      const { job_name, product, factories, order_details } = body;
      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .insert({
          user_id: user.id,
          job_name,
          product,
          factories,
          order_details,
          status: "waiting",
        })
        .select()
        .single();
      return NextResponse.json({ success: true, job });
    }

    // ── SEND RFQ EMAILS ──────────────────────────────────────────────────
    if (action === "send_rfq") {
      const { job_id } = body;

      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

      const { data: gmailConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!gmailConn?.access_token) {
        return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
      }

      // Refresh token if needed
      let accessToken = gmailConn.access_token;
      if (new Date(gmailConn.token_expiry) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: gmailConn.refresh_token,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          await supabaseAdmin.from("gmail_connections").update({
            access_token: accessToken,
            token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          }).eq("user_id", user.id);
        }
      }

      const product = job.product || {};
      const orderDetails = job.order_details || {};
      const results: { factory: string; success: boolean; error?: string }[] = [];

      for (const factory of (job.factories || [])) {
        try {
          // Use Claude Haiku to draft a professional RFQ email
          const draftRes = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 600,
            system: "You write professional, concise RFQ (Request for Quotation) emails to factories. Be direct and specific. No fluff.",
            messages: [{
              role: "user",
              content: `Write an RFQ email to ${factory.name} (${factory.email}) for this product:
Product: ${product.name || job.job_name}
Description: ${product.description || ""}
Specs: ${product.specs || ""}
Target Quantity: ${product.target_quantity || orderDetails.quantity || "TBD"}
Duty: ${orderDetails.duty_pct || 30}%, Tariff: ${orderDetails.tariff_pct || 20}%

Write subject line on first line, then blank line, then email body. Sign off as "Jimmy AI - Procurement".
Ask for: unit price, MOQ, lead time, payment terms. Request they reply with an Excel quote sheet.`,
            }],
          });

          const draftText = draftRes.content[0].type === "text" ? draftRes.content[0].text : "";
          const lines = draftText.split("\n");
          const subjectLine = lines[0].replace(/^subject:\s*/i, "").trim();
          const emailBody = lines.slice(2).join("\n").trim();

          // Send via Gmail API
          const emailRaw = [
            `To: ${factory.email}`,
            `Subject: ${subjectLine}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            emailBody,
          ].join("\r\n");

          const encoded = Buffer.from(emailRaw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

          const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encoded }),
          });

          const sendData = await sendRes.json();
          if (sendData.id) {
            results.push({ factory: factory.name, success: true });
          } else {
            results.push({ factory: factory.name, success: false, error: sendData.error?.message || "Send failed" });
          }
        } catch (err) {
          results.push({ factory: factory.name, success: false, error: String(err) });
        }
      }

      // Update job status
      await supabaseAdmin.from("factory_quote_jobs").update({
        status: "rfq_sent",
        rfq_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      return NextResponse.json({ success: true, results });
    }

    // ── PROCESS UPLOADED FILE ────────────────────────────────────────────
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

      const imagesByRow: Record<number, string> = {};
      try {
        const zip = await JSZip.loadAsync(buffer);
        const mediaEntries: { name: string; data: string }[] = [];
        for (const [path, file] of Object.entries(zip.files)) {
          if (path.startsWith("xl/media/") && !(file as any).dir) {
            const imgBuffer = await (file as any).async("base64");
            const ext = path.split(".").pop() || "png";
            const fname = path.split("/").pop() || "";
            mediaEntries.push({ name: fname, data: `data:image/${ext};base64,${imgBuffer}` });
          }
        }
        mediaEntries.sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
          return numA - numB;
        });
        mediaEntries.forEach((entry, i) => { imagesByRow[i + 1] = entry.data; });
      } catch {}

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: `You are extracting factory quote data from an Excel file. Extract every product with all its details.
Return ONLY raw JSON, no markdown:
{
  "factory_name": "name of factory if found in file",
  "products": [
    {
      "product_name": "name/description of product",
      "specs": "material, size, color, technique, capacity etc",
      "sku": "product code if any",
      "unit_cost": 0.00,
      "currency": "USD",
      "moq": 0,
      "lead_time_days": 0,
      "notes": "any other relevant info"
    }
  ]
}`,
        messages: [{ role: "user", content: `Extract all products from this factory quote:\n${allData.slice(0, 8000)}` }],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));

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
        const afterDuty = firstCost * (1 + dutyPct);
        const afterTariff = afterDuty * (1 + tariffPct);
        const elc = afterTariff + freight;
        return {
          ...p,
          factory_name: (factory_name || parsed.factory_name || "Unknown")
            .replace(/_Quote_with_Images$/i, "")
            .replace(/_Quote$/i, "")
            .replace(/ Quote with Images$/i, "")
            .replace(/ Quote$/i, "")
            .replace(/_/g, " ")
            .trim(),
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

      const { data: allQuotes } = await supabaseAdmin
        .from("factory_quotes")
        .select("factory_name")
        .eq("job_id", job_id);

      const totalFactories = (jobRow?.factories || []).length;
      const receivedFactories = allQuotes?.length || 0;
      const newStatus = receivedFactories >= totalFactories ? "ready" : "rfq_sent";

      await supabaseAdmin.from("factory_quote_jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job_id);

      // Auto-build master sheet if all quotes received
      if (newStatus === "ready") {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/factory-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "build_master", job_id, user_id: user.id }),
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
            const fileBuffer = Buffer.from(quote.raw_file_base64, "base64");
            const zip = await JSZip.loadAsync(fileBuffer);
            const mediaEntries: { name: string; data: string }[] = [];
            for (const [path, file] of Object.entries(zip.files)) {
              if (path.startsWith("xl/media/") && !(file as any).dir) {
                const imgBuffer = await (file as any).async("base64");
                const ext = path.split(".").pop() || "png";
                mediaEntries.push({ name: path.split("/").pop() || "", data: `data:image/${ext};base64,${imgBuffer}` });
              }
            }
            mediaEntries.sort((a, b) => {
              const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
              const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
              return numA - numB;
            });
            mediaEntries.forEach((entry, i) => { quoteImages[i + 1] = entry.data; });
          } catch {}
        }
        for (let i = 0; i < (quote.processed_data || []).length; i++) {
          allProducts.push({ ...quote.processed_data[i], image_base64: quoteImages[i + 1] || null });
        }
      }

      const productGroups: Record<string, any[]> = {};
      for (const product of allProducts) {
        const key = product.product_name || "Unknown";
        if (!productGroups[key]) productGroups[key] = [];
        productGroups[key].push(product);
      }
      for (const key of Object.keys(productGroups)) {
        productGroups[key].sort((a, b) => a.elc - b.elc);
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = "Jimmy AI";
      wb.created = new Date();

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
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { bottom: { style: "thin", color: { argb: "FF444444" } } };
      });
      headerRow.height = 20;

      for (const [productName, factories] of Object.entries(productGroups)) {
        factories.forEach((f: any, index: number) => {
          let competitiveness = "";
          if (index === 0) competitiveness = "🥇 Most Competitive";
          else if (index === 1) competitiveness = "🥈 2nd Best";
          else if (index === 2) competitiveness = "🥉 3rd Best";
          else competitiveness = `${index + 1}th`;

          const isBest = index === 0;
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
            comp: competitiveness,
            notes: f.notes || "",
          });

          const rowNum2 = row.number;
          const sellCell = row.getCell("sell");
          const mCell = row.getCell("margin");
          sellCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFACD" } };
          sellCell.note = "Enter your sell price here";
          mCell.value = { formula: `=IF(J${rowNum2}="","",((J${rowNum2}-I${rowNum2})/J${rowNum2}))` };
          mCell.numFmt = "0.00%";

          if (index === 0 && f.image_base64) {
            try {
              const imageData = f.image_base64.split(",")[1] || f.image_base64;
              const ext = f.image_base64.includes("png") ? "png" : "jpeg";
              const imageId = wb.addImage({ base64: imageData, extension: ext as "png" | "jpeg" });
              const rowNum = row.number;
              ws.addImage(imageId, { tl: { col: 0, row: rowNum - 1 }, ext: { width: 80, height: 60 }, editAs: "oneCell" });
              row.height = 60;
            } catch {}
          }

          if (isBest) {
            row.eachCell((cell) => {
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

      const summaryWs = wb.addWorksheet("Summary");
      summaryWs.columns = [
        { header: "Product", key: "product", width: 32 },
        { header: "Best Factory", key: "factory", width: 22 },
        { header: "Best ELC", key: "elc", width: 12 },
        { header: "Best Margin%", key: "margin", width: 14 },
        { header: "Savings vs 2nd Best", key: "savings", width: 38 },
        { header: "2nd Best Factory", key: "second", width: 22 },
        { header: "2nd Best ELC", key: "second_elc", width: 14 },
        { header: "Negotiation Target", key: "target", width: 30 },
      ];

      const summaryHeader = summaryWs.getRow(1);
      summaryHeader.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      summaryHeader.height = 20;

      for (const [productName, factories] of Object.entries(productGroups)) {
        if (factories.length < 1) continue;
        const best = factories[0];
        const second = factories.length > 1 ? factories[1] : null;
        const savings = second ? Math.round((second.elc - best.elc) * 100) / 100 : 0;
        const negotiationTarget = second
          ? `Ask ${second.factory_name} to match $${best.first_cost}/unit`
          : "Only one quote received";

        const row = summaryWs.addRow({
          product: productName,
          factory: best.factory_name,
          elc: best.elc,
          margin: "Fill in sell price on Comparison tab",
          savings: second ? (savings > 0 ? `$${savings} cheaper than ${second.factory_name}` : "Same price as 2nd best") : "No comparison",
          second: second?.factory_name || "—",
          second_elc: second?.elc || "—",
          target: negotiationTarget,
        });

        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
          cell.font = { bold: false, size: 10 };
        });
        row.height = 18;
      }

      summaryWs.views = [{ state: "frozen", ySplit: 1 }];

      const excelBuffer = await wb.xlsx.writeBuffer();
      const base64 = Buffer.from(excelBuffer).toString("base64");

      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
      const fileName = `${date} Factory Quote Comparison — ${job.job_name}.xlsx`;

      const { data: gmailConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", job.user_id)
        .single();

      let sheetUrl = null;
      if (gmailConn?.access_token) {
        try {
          const uploadRes = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${gmailConn.access_token}`,
                "Content-Type": "multipart/related; boundary=boundary",
              },
              body: [
                "--boundary",
                "Content-Type: application/json",
                "",
                JSON.stringify({ name: fileName, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                "--boundary",
                "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Transfer-Encoding: base64",
                "",
                base64,
                "--boundary--",
              ].join("\r\n"),
            }
          );
          const uploadData = await uploadRes.json();
          if (uploadData.id) sheetUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
        } catch {}
      }

      await supabaseAdmin.from("factory_quote_jobs").update({
        status: "complete",
        master_sheet_url: sheetUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      await supabaseAdmin.from("pending_actions").insert({
        user_id: job.user_id,
        workflow_type: "factory_quote",
        action_type: "create_sheet",
        title: `Factory Quote Comparison Ready — ${job.job_name}`,
        description: `Master comparison sheet built with ${Object.keys(productGroups).length} products across ${job.factory_quotes?.length} factories.`,
        payload: { file_name: fileName, sheet_url: sheetUrl, base64 },
        status: "pending",
      });

      return NextResponse.json({ success: true, fileName, sheetUrl, base64 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
