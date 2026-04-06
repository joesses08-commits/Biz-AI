import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";

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

const ASK_FOR_LABELS: Record<string, string> = {
  price: "Unit Price",
  sample_lead_time: "Sample Lead Time",
  moq: "MOQ",
  lead_time: "Production Lead Time",
  sample_price: "Sample Price",
  payment_terms: "Payment Terms",
  packaging: "Packaging Details",
  notes: "Notes / Comments",
};

const INCLUDE_LABELS: Record<string, string> = {
  name: "Product Name",
  sku: "SKU",
  description: "Description",
  specs: "Specifications",
  images: "Image URLs",
  category: "Category",
  collection: "Collection",
  notes: "Notes",
};

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_ids, include, ask_for } = await req.json();
  if (!product_ids?.length) return NextResponse.json({ error: "No products selected" }, { status: 400 });

  // Fetch products
  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name)")
    .in("id", product_ids)
    .eq("user_id", user.id);

  if (!products?.length) return NextResponse.json({ error: "Products not found" }, { status: 404 });

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("RFQ");

  // Header style
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      bottom: { style: "thin", color: { argb: "FF444444" } },
    },
  };

  const askStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FF000000" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  // Build columns
  const columns: { header: string; key: string; width: number; isAsk?: boolean }[] = [];
  
  (include || []).forEach((key: string) => {
    columns.push({ header: INCLUDE_LABELS[key] || key, key, width: 25 });
  });

  (ask_for || []).forEach((key: string) => {
    columns.push({ header: ASK_FOR_LABELS[key] || key, key: `ask_${key}`, width: 20, isAsk: true });
  });

  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    Object.assign(cell, col.isAsk ? askStyle : headerStyle);
  });

  // Add product rows
  products.forEach((product: any) => {
    const row: any = {};
    (include || []).forEach((key: string) => {
      if (key === "collection") row[key] = product.plm_collections?.name || "";
      else if (key === "images") row[key] = (product.images || []).join(", ");
      else row[key] = product[key] || "";
    });
    (ask_for || []).forEach((key: string) => {
      row[`ask_${key}`] = "";
    });
    sheet.addRow(row);
  });

  // Style data rows
  for (let i = 2; i <= products.length + 1; i++) {
    const row = sheet.getRow(i);
    row.height = 20;
    columns.forEach((col, j) => {
      const cell = row.getCell(j + 1);
      cell.border = { bottom: { style: "hair", color: { argb: "FF333333" } } };
      if (col.isAsk) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E6" } };
      }
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Create factory quote job
  const jobName = `RFQ - ${products.length} Products - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  
  const { data: job, error: jobError } = await supabaseAdmin
    .from("factory_quote_jobs")
    .insert({
      user_id: user.id,
      job_name: jobName,
      status: "waiting",
      factories: [],
      duty_rate: 0,
      tariff_rate: 0,
      freight_per_unit: 0,
      product_file_base64: base64,
      product_file_name: `RFQ_${Date.now()}.xlsx`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError || !job) return NextResponse.json({ error: jobError?.message || "Failed to create job" }, { status: 500 });

  // Link products to job + update their stage to artwork_sent
  await Promise.all(products.map(async (product: any) => {
    await supabaseAdmin.from("plm_products").update({
      rfq_job_id: job.id,
      updated_at: new Date().toISOString(),
    }).eq("id", product.id);
  }));

  // Log to company events
  await supabaseAdmin.from("company_events").insert({
    user_id: user.id,
    source: "PLM",
    event_type: "rfq_created",
    title: `RFQ created for ${products.length} products`,
    summary: `RFQ job "${jobName}" created with ${products.length} products. Ready to send to factories.`,
    importance: "high",
    raw_data: { job_id: job.id, product_ids, include, ask_for },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, job_id: job.id, job_name: jobName });
}
