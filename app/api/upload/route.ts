import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { parseNum } from "@/lib/utils";
import { DatasetType } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { type, filename, rows } = await req.json() as {
      type: DatasetType;
      filename: string;
      rows: Record<string, unknown>[];
    };

    if (!type || !rows?.length) {
      return NextResponse.json({ error: "Missing type or rows" }, { status: 400 });
    }

    const supabase = createServerClient();
    const userId = "demo-user"; // No auth for prototype

    // 1. Delete any existing upload of same type (replace strategy)
    const { data: existing } = await supabase
      .from("uploads")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type);

    if (existing?.length) {
      await supabase.from("uploads").delete().eq("user_id", userId).eq("type", type);
    }

    // 2. Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({ user_id: userId, type, filename, row_count: rows.length })
      .select()
      .single();

    if (uploadError) throw uploadError;

    // 3. Insert rows into the right table
    const uploadId = upload.id;

    if (type === "sales") {
      const mapped = rows.map((r) => ({
        upload_id: uploadId,
        date: findVal(r, ["date", "Date", "DATE", "order_date", "sale_date"]) || null,
        product_id: String(findVal(r, ["product_id", "Product ID", "sku", "SKU", "item_id"]) || ""),
        product_name: String(findVal(r, ["product_name", "Product", "product", "item", "Item", "name"]) || ""),
        customer_id: String(findVal(r, ["customer_id", "Customer ID", "client_id"]) || ""),
        customer_name: String(findVal(r, ["customer_name", "Customer", "customer", "client", "Client"]) || ""),
        revenue: parseNum(findVal(r, ["revenue", "Revenue", "amount", "Amount", "total", "Total", "sales", "Sales"])),
        quantity: parseNum(findVal(r, ["quantity", "Quantity", "qty", "Qty", "units", "Units"])),
        discount: parseNum(findVal(r, ["discount", "Discount", "discount_pct"])),
        category: String(findVal(r, ["category", "Category", "type", "Type"]) || ""),
        region: String(findVal(r, ["region", "Region", "territory", "Territory"]) || ""),
      }));
      const { error } = await supabase.from("sales_rows").insert(mapped);
      if (error) throw error;
    }

    else if (type === "costs") {
      const mapped = rows.map((r) => ({
        upload_id: uploadId,
        date: findVal(r, ["date", "Date", "DATE"]) || null,
        category: String(findVal(r, ["category", "Category", "type", "Type", "expense_type"]) || "Uncategorized"),
        amount: parseNum(findVal(r, ["amount", "Amount", "cost", "Cost", "expense", "Expense", "total", "Total"])),
        vendor: String(findVal(r, ["vendor", "Vendor", "supplier", "Supplier", "payee", "Payee"]) || ""),
        description: String(findVal(r, ["description", "Description", "notes", "Notes", "memo"]) || ""),
      }));
      const { error } = await supabase.from("cost_rows").insert(mapped);
      if (error) throw error;
    }

    else if (type === "products") {
      const mapped = rows.map((r) => ({
        upload_id: uploadId,
        product_id: String(findVal(r, ["product_id", "Product ID", "sku", "SKU", "id", "ID"]) || ""),
        name: String(findVal(r, ["name", "Name", "product_name", "Product Name", "product"]) || ""),
        unit_cost: parseNum(findVal(r, ["unit_cost", "Unit Cost", "cost", "Cost", "cogs", "COGS"])),
        unit_price: parseNum(findVal(r, ["unit_price", "Unit Price", "price", "Price", "retail_price", "msrp"])),
        category: String(findVal(r, ["category", "Category", "type", "Type"]) || ""),
        sku: String(findVal(r, ["sku", "SKU"]) || ""),
      }));
      const { error } = await supabase.from("product_rows").insert(mapped);
      if (error) throw error;
    }

    else if (type === "customers") {
      const mapped = rows.map((r) => ({
        upload_id: uploadId,
        customer_id: String(findVal(r, ["customer_id", "Customer ID", "id", "ID"]) || ""),
        name: String(findVal(r, ["name", "Name", "customer_name", "Customer Name"]) || ""),
        segment: String(findVal(r, ["segment", "Segment", "tier", "Tier", "type", "Type"]) || ""),
        region: String(findVal(r, ["region", "Region", "territory", "state", "State"]) || ""),
        acquisition_date: findVal(r, ["acquisition_date", "start_date", "joined_date", "created_at"]) || null,
      }));
      const { error } = await supabase.from("customer_rows").insert(mapped);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, uploadId, rowCount: rows.length });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// Helper: find a value by trying multiple possible column names
function findVal(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}
