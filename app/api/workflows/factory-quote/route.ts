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

// ── GET: list all jobs for the user ───────────────────────────────────────
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
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

// ── POST: create job, process quote, or build master sheet ────────────────
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── CREATE JOB ──────────────────────────────────────────────────────
    if (action === "create_job") {
      const { job_name, factories, order_details } = body;
      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .insert({
          user_id: user.id,
          job_name,
          factories,
          order_details,
          status: "waiting",
        })
        .select()
        .single();

      return NextResponse.json({ success: true, job });
    }

    // ── PROCESS UPLOADED FILE ────────────────────────────────────────────
    if (action === "process_file") {
      const { job_id, factory_name, factory_email, file_base64, file_name } = body;

      // Decode Excel file
      const buffer = Buffer.from(file_base64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      
      // Read all sheets
      let allData = "";
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        allData += `\nSHEET: ${sheetName}\n${csv}\n`;
      }

      // Extract images from Excel zip — store in order, ignore row positions
      const imagesByRow: Record<number, string> = {};
      try {
        const zip = await JSZip.loadAsync(buffer);

        // Get all media files sorted by filename (image1, image2, image3...)
        const mediaEntries: { name: string; data: string }[] = [];
        for (const [path, file] of Object.entries(zip.files)) {
          if (path.startsWith("xl/media/") && !(file as any).dir) {
            const imgBuffer = await (file as any).async("base64");
            const ext = path.split(".").pop() || "png";
            const fname = path.split("/").pop() || "";
            mediaEntries.push({ name: fname, data: `data:image/${ext};base64,${imgBuffer}` });
          }
        }

        // Sort by filename so image1 < image2 < image10
        mediaEntries.sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
          return numA - numB;
        });

        // Map in order: image 0 = product 1, image 1 = product 2, etc.
        mediaEntries.forEach((entry, i) => {
          imagesByRow[i + 1] = entry.data; // 1-indexed
        });

      } catch (imgErr) { console.error("Image extraction error:", imgErr); }

      // Use Claude to extract products and pricing
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

      // Get order details for calculations
      const { data: job } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("order_details")
        .eq("id", job_id)
        .single();

      const orderDetails = job?.order_details || {};
      const dutyPct = parseFloat(orderDetails.duty_pct || "30") / 100;
      const tariffPct = parseFloat(orderDetails.tariff_pct || "20") / 100;
      const freight = parseFloat(orderDetails.freight || "0.15");

      // Calculate ELC only — no sell price or margin (Uncle David sets sell prices manually)
      const processedProducts = (parsed.products || []).map((p: any) => {
        const firstCost = parseFloat(p.unit_cost) || 0;
        const afterDuty = firstCost * (1 + dutyPct);
        const afterTariff = afterDuty * (1 + tariffPct);
        const elc = afterTariff + freight;
        return {
          ...p,
          factory_name: (factory_name || parsed.factory_name || "Unknown").replace(/_Quote$/, "").replace(/_/g, " "),
          factory_email,
          first_cost: firstCost,
          duty_pct: orderDetails.duty_pct || "30",
          tariff_pct: orderDetails.tariff_pct || "20",
          freight,
          elc: Math.round(elc * 100) / 100,
        };
      });

      // Attach images to products by order (image 1 = product 1, image 2 = product 2)
      const processedWithImages = processedProducts.map((p: any, i: number) => ({
        ...p,
        image_base64: imagesByRow[i + 1] || null,
      }));

      // Save to factory_quotes table
      await supabaseAdmin.from("factory_quotes").insert({
        job_id,
        user_id: user.id,
        factory_name,
        factory_email,
        attachment_name: file_name,
        raw_data: parsed.products || [],
        processed_data: processedWithImages,
        status: "processed",
      });

      // Update job status
      const { data: allQuotes } = await supabaseAdmin
        .from("factory_quotes")
        .select("factory_name")
        .eq("job_id", job_id);

      const { data: jobData } = await supabaseAdmin
        .from("factory_quote_jobs")
        .select("factories")
        .eq("id", job_id)
        .single();

      const totalFactories = (jobData?.factories || []).length;
      const receivedFactories = allQuotes?.length || 0;
      const newStatus = receivedFactories >= totalFactories ? "ready" : "waiting";

      await supabaseAdmin.from("factory_quote_jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job_id);

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

      // Collect all products across all factories
      const allProducts: any[] = [];
      for (const quote of (job.factory_quotes || [])) {
        for (const product of (quote.processed_data || [])) {
          allProducts.push(product);
        }
      }

      // Group by product name and sort each group by margin (best first)
      const productGroups: Record<string, any[]> = {};
      for (const product of allProducts) {
        const key = product.product_name || "Unknown";
        if (!productGroups[key]) productGroups[key] = [];
        productGroups[key].push(product);
      }

      // Sort each group by ELC ascending (cheapest first)
      for (const key of Object.keys(productGroups)) {
        productGroups[key].sort((a, b) => a.elc - b.elc);
      }

      // Build Excel workbook using ExcelJS for full styling + image support
      const wb = new ExcelJS.Workbook();
      wb.creator = "Jimmy AI";
      wb.created = new Date();

      // ── QUOTE COMPARISON SHEET ─────────────────────────────────────────
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

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FF444444" } },
        };
      });
      headerRow.height = 20;

      // Add data rows
      for (const [productName, factories] of Object.entries(productGroups)) {
        factories.forEach((f: any, index: number) => {
          let competitiveness = "";
          if (index === 0) competitiveness = "🥇 Most Competitive";
          else if (index === 1) competitiveness = "🥈 2nd Best";
          else if (index === 2) competitiveness = "🥉 3rd Best";
          else competitiveness = `${index + 1}th`;

          const marginNum = parseFloat(f.margin_pct);
          const isNegative = marginNum < 0;
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
            sell: f.sell_price,
            margin: `${f.margin_pct}%`,
            moq: f.moq || "",
            lead: f.lead_time_days || "",
            comp: competitiveness,
            notes: f.notes || "",
          });

          // Embed product image if available (only on first factory row per product)
          if (index === 0 && f.image_base64) {
            try {
              const imageData = f.image_base64.split(",")[1] || f.image_base64;
              const ext = f.image_base64.includes("png") ? "png" : "jpeg";
              const imageId = wb.addImage({
                base64: imageData,
                extension: ext as "png" | "jpeg",
              });
              const rowNum = row.number;
              ws.addImage(imageId, {
                tl: { col: 0, row: rowNum - 1 },
                ext: { width: 80, height: 60 },
                editAs: "oneCell",
              });
              row.height = 60; // taller row to show image
            } catch (imgErr) {
              console.error("Image embed error:", imgErr);
            }
          }

          // Yellow for best price row
          if (isBest) {
            row.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
              cell.font = { bold: true, size: 10 };
            });
          }

          // Red for negative margin (override just the margin cell)
          if (isNegative) {
            const marginCell = row.getCell("margin");
            marginCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF4444" } };
            marginCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
          }

          row.height = 18;
        });

        // Empty spacer row between products
        ws.addRow({});
      }

      // Freeze header row
      ws.views = [{ state: "frozen", ySplit: 1 }];

      // ── SUMMARY SHEET ──────────────────────────────────────────────────
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

      // Style summary header
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
          savings: second
            ? savings > 0
              ? `$${savings} cheaper than ${second.factory_name}`
              : "Same price as 2nd best"
            : "No comparison",
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

      // Convert to base64
      const excelBuffer = await wb.xlsx.writeBuffer();
      const base64 = Buffer.from(excelBuffer).toString("base64");

      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
      const fileName = `${date} Factory Quote Comparison — ${job.job_name}.xlsx`;

      // Try to save to Google Drive
      const { data: gmailConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
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
          if (uploadData.id) {
            sheetUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
          }
        } catch {}
      }

      // Update job with master sheet URL
      await supabaseAdmin.from("factory_quote_jobs").update({
        status: "complete",
        master_sheet_url: sheetUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      // Add to pending actions for approval notification
      await supabaseAdmin.from("pending_actions").insert({
        user_id: user.id,
        workflow_type: "factory_quote",
        action_type: "create_sheet",
        title: `Factory Quote Comparison Ready — ${job.job_name}`,
        description: `Master comparison sheet built with ${Object.keys(productGroups).length} products across ${job.factory_quotes?.length} factories. Sorted by best margin per product.`,
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
