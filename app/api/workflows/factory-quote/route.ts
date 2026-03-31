import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";

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

      // Use Claude to extract products and pricing
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
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
      const sellPrice = parseFloat(orderDetails.sell_price || "3.50");

      // Calculate ELC and margin for each product
      const processedProducts = (parsed.products || []).map((p: any) => {
        const firstCost = parseFloat(p.unit_cost) || 0;
        const afterDuty = firstCost * (1 + dutyPct);
        const afterTariff = afterDuty * (1 + tariffPct);
        const elc = afterTariff + freight;
        const margin = sellPrice > 0 ? ((sellPrice - elc) / sellPrice * 100) : 0;
        return {
          ...p,
          factory_name: factory_name || parsed.factory_name,
          factory_email,
          first_cost: firstCost,
          duty_pct: orderDetails.duty_pct || "30",
          tariff_pct: orderDetails.tariff_pct || "20",
          freight,
          elc: Math.round(elc * 100) / 100,
          sell_price: sellPrice,
          margin_pct: Math.round(margin * 100) / 100,
        };
      });

      // Save to factory_quotes table
      await supabaseAdmin.from("factory_quotes").insert({
        job_id,
        user_id: user.id,
        factory_name,
        factory_email,
        attachment_name: file_name,
        raw_data: parsed.products || [],
        processed_data: processedProducts,
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

      // Sort each group by margin descending
      for (const key of Object.keys(productGroups)) {
        productGroups[key].sort((a, b) => b.margin_pct - a.margin_pct);
      }

      // Build Excel workbook
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [];

      // Header row
      rows.push([
        "Product", "Specs", "SKU", "Factory", "Factory Email",
        "First Cost", "Duty%", "Tariff%", "Freight", "ELC", "Sell", "Margin%",
        "MOQ", "Lead Time (days)", "Competitiveness", "Notes"
      ]);

      // Data rows grouped by product
      for (const [productName, factories] of Object.entries(productGroups)) {
        factories.forEach((f, index) => {
          let competitiveness = "";
          if (index === 0) competitiveness = "🥇 Most Competitive";
          else if (index === 1) competitiveness = "🥈 2nd Best";
          else if (index === 2) competitiveness = "🥉 3rd Best";
          else competitiveness = `${index + 1}th`;

          rows.push([
            index === 0 ? productName : "",
            index === 0 ? f.specs : "",
            index === 0 ? f.sku : "",
            f.factory_name,
            f.factory_email,
            f.first_cost,
            `${f.duty_pct}%`,
            `${f.tariff_pct}%`,
            f.freight,
            f.elc,
            f.sell_price,
            `${f.margin_pct}%`,
            f.moq || "",
            f.lead_time_days || "",
            competitiveness,
            f.notes || "",
          ]);
        });
        // Empty row between products
        rows.push(new Array(16).fill(""));
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Column widths
      ws["!cols"] = [
        { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 25 },
        { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Quote Comparison");

      // Summary sheet
      const summaryRows: any[][] = [["Summary — Best Factory Per Product"], [""]];
      summaryRows.push(["Product", "Best Factory", "Best ELC", "Best Margin%", "Savings vs Worst"]);

      for (const [productName, factories] of Object.entries(productGroups)) {
        if (factories.length < 2) continue;
        const best = factories[0];
        const worst = factories[factories.length - 1];
        const savings = Math.round((worst.elc - best.elc) * 100) / 100;
        summaryRows.push([
          productName,
          best.factory_name,
          best.elc,
          `${best.margin_pct}%`,
          `$${savings} savings vs ${worst.factory_name}`,
        ]);
      }

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
      summaryWs["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Convert to base64
      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const base64 = excelBuffer.toString("base64");

      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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
