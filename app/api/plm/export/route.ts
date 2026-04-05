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

async function fetchImageBase64(url: string): Promise<{data: string, ext: string} | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const b64 = Buffer.from(ab).toString("base64");
    const ext = url.split(".").pop()?.toLowerCase() || "jpeg";
    return { data: b64, ext };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_ids, columns, include_images } = await req.json();

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), factory_catalog(name), plm_batches(*)")
    .in("id", product_ids)
    .eq("user_id", user.id);

  if (!products?.length) return NextResponse.json({ error: "No products found" }, { status: 404 });

  const COLUMN_LABELS: Record<string, string> = {
    name: "Product Name", sku: "SKU", description: "Description",
    specs: "Specifications", category: "Category", collection: "Collection",
    factory: "Factory", target_elc: "ELC ($)", target_sell_price: "Sell Price ($)",
    margin: "Margin (%)", order_quantity: "Order Qty", moq: "MOQ",
    current_stage: "Status", notes: "Notes",
  };

  const selectedColumns = (columns || ["name","sku","description","specs","category","collection","current_stage"]).filter((c: string) => c !== "images");
  const showImages = include_images !== false;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Jimmy AI";
  const ws = wb.addWorksheet("Product Catalog");

  const ROW_HEIGHT = 80;
  const IMG_SIZE = 70;
  const IMG_COL_WIDTH = 12;
  const DATA_COL_WIDTH = 20;

  // Set columns
  const wsCols: any[] = [];
  if (showImages) wsCols.push({ width: IMG_COL_WIDTH });
  selectedColumns.forEach(() => wsCols.push({ width: DATA_COL_WIDTH }));
  ws.columns = wsCols;

  // Header row
  const headerRow: any[] = [];
  if (showImages) headerRow.push("Photo");
  selectedColumns.forEach((col: string) => headerRow.push(COLUMN_LABELS[col] || col));
  const hRow = ws.addRow(headerRow);
  hRow.height = 24;
  hRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a1a" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF333333" } } };
  });

  // Data rows
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const rowNum = i + 2; // 1-indexed, row 1 is header

    // Derive status from batches
    const BATCH_ORDER = ["rfq_sent","factory_selected","po_issued","production_started","production_complete","qc_inspection","shipped","in_transit","customs","delivered","active"];
    const BATCH_LABELS: Record<string,string> = { rfq_sent:"RFQ Sent", factory_selected:"Factory Selected", po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", shipped:"Shipped", in_transit:"In Transit", customs:"Customs", delivered:"Delivered", active:"Active" };
    const batches = p.plm_batches || [];
    let statusKey = "";
    let statusIdx = -1;
    for (const b of batches) {
      const idx = BATCH_ORDER.indexOf(b.current_stage);
      if (idx > statusIdx) { statusIdx = idx; statusKey = b.current_stage; }
    }

    const rowData: any[] = [];
    if (showImages) rowData.push(""); // placeholder for image cell
    selectedColumns.forEach((col: string) => {
      switch (col) {
        case "collection": rowData.push(p.plm_collections?.name || ""); break;
        case "factory": rowData.push(p.factory_catalog?.name || ""); break;
        case "margin":
          if (p.target_elc && p.target_sell_price) rowData.push(`${Math.round(((p.target_sell_price - p.target_elc) / p.target_sell_price) * 100)}%`);
          else rowData.push("");
          break;
        case "current_stage": rowData.push(statusKey ? BATCH_LABELS[statusKey] : "Pre-production"); break;
        default: rowData.push(p[col] !== null && p[col] !== undefined ? p[col] : ""); break;
      }
    });

    const row = ws.addRow(rowData);
    row.height = ROW_HEIGHT;
    row.eachCell(cell => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.font = { size: 9 };
      if (i % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
      }
    });

    // Embed image if available
    if (showImages && p.images?.[0]) {
      const imgData = await fetchImageBase64(p.images[0]);
      if (imgData) {
        const mimeType = imgData.ext === "png" ? "png" : "jpeg";
        try {
          const imgId = wb.addImage({ base64: imgData.data, extension: mimeType });
          ws.addImage(imgId, {
            tl: { col: 0, row: rowNum - 1 },
            ext: { width: IMG_SIZE, height: IMG_SIZE },
          });
        } catch {}
      }
    }
  }

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="product-catalog-${Date.now()}.xlsx"`,
    },
  });
}
