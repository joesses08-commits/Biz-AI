import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/get-user";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



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
  weight: "Weight",
  dimensions: "Dimensions",
  images: "Image URLs",
  category: "Category",
  collection: "Collection",
  notes: "Notes",
};

export async function POST(req: NextRequest) {
  const user = await getEffectiveUser(req);
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

  // Check if any product has an image
  const hasImages = products.some((p: any) => p.images && p.images.length > 0);
  const hasRefUrls = products.some((p: any) => p.reference_url);
  const imageColOffset = hasImages ? 1 : 0;

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("RFQ");

  // Header style
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: { bottom: { style: "thin", color: { argb: "FF444444" } } },
  };

  const askStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FF000000" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } },
    alignment: { horizontal: "center", vertical: "middle" },
  };

  // Build columns — image first if any, then info, then ref url, then ask-for
  const columns: { header: string; key: string; width: number; isAsk?: boolean; isImage?: boolean }[] = [];

  if (hasImages) {
    columns.push({ header: "Image", key: "_image", width: 15, isImage: true });
  }

  (include || []).filter((k: string) => k !== "images").forEach((key: string) => {
    columns.push({ header: INCLUDE_LABELS[key] || key, key, width: 25 });
  });

  // Add image URLs as text column if included
  if ((include || []).includes("images")) {
    columns.push({ header: "Image URL", key: "images", width: 30 });
  }

  // Reference URL column
  if ((include || []).includes("reference_url")) {
    columns.push({ header: "Reference / Dropbox Link", key: "reference_url", width: 35 });
  }

  (ask_for || []).forEach((key: string) => {
    columns.push({ header: ASK_FOR_LABELS[key] || key, key: `ask_${key}`, width: 20, isAsk: true });
  });

  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    if (col.isImage) {
      Object.assign(cell, { ...headerStyle, value: "Image" });
    } else {
      Object.assign(cell, col.isAsk ? askStyle : headerStyle);
    }
  });

  // Add product rows with images
  const ROW_HEIGHT = 80;
  for (let pi = 0; pi < products.length; pi++) {
    const product = products[pi] as any;
    const rowNum = pi + 2;
    const row: any = {};

    (include || []).filter((k: string) => k !== "images").forEach((key: string) => {
      if (key === "collection") row[key] = product.plm_collections?.name || "";
      else row[key] = product[key] || "";
    });
    if ((include || []).includes("images")) row["images"] = (product.images || []).join(", ");
    row["reference_url"] = product.reference_url || "";
    (ask_for || []).forEach((key: string) => { row[`ask_${key}`] = ""; });

    const excelRow = sheet.addRow(row);
    excelRow.height = hasImages ? ROW_HEIGHT : 20;

    // Embed image in column A if product has one
    if (hasImages) {
      const imageUrl = product.images?.[0];
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const imgBuffer = await imgRes.arrayBuffer();
            const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpeg";
            const mimeMap: any = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif" };
            const imgType = mimeMap[ext] || "jpeg";
            const imageId = workbook.addImage({ buffer: Buffer.from(new Uint8Array(imgBuffer)) as any, extension: imgType as any });
            sheet.addImage(imageId, {
              tl: { col: 0, row: rowNum - 1 },
              ext: { width: 80, height: 80 },
            });
          }
        } catch {}
      }
    }

    // Style data cells
    columns.forEach((col, j) => {
      const cell = excelRow.getCell(j + 1);
      cell.border = { bottom: { style: "hair", color: { argb: "FF333333" } } };
      if (col.isAsk) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E6" } };
      }
      cell.alignment = { vertical: "top", wrapText: true };
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
      status: "draft",
      factories: [],
      order_details: { plm_product_ids: product_ids, include, ask_for },
      product_file_base64: base64,
      product_file_name: `RFQ_${Date.now()}.xlsx`,
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

  return NextResponse.json({ 
    success: true, 
    job_id: job.id, 
    job_name: jobName,
    file_base64: base64,
    file_name: `RFQ_${Date.now()}.xlsx`
  });
}
