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

  const { product_ids, columns, include_images } = await req.json();

  const { data: products } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), factory_catalog(name)")
    .in("id", product_ids)
    .eq("user_id", user.id);

  if (!products?.length) return NextResponse.json({ error: "No products found" }, { status: 404 });

  // Build CSV as fallback (ExcelJS would need npm install)
  const COLUMN_LABELS: any = {
    name: "Product Name",
    sku: "SKU",
    description: "Description",
    specs: "Specifications",
    category: "Category",
    collection: "Collection",
    factory: "Factory",
    target_elc: "ELC ($)",
    target_sell_price: "Sell Price ($)",
    margin: "Margin (%)",
    order_quantity: "Order Qty",
    moq: "MOQ",
    current_stage: "Current Stage",
    notes: "Notes",
    images: "Image URL",
  };

  const selectedColumns = columns || ["name", "sku", "description", "specs", "category", "collection", "current_stage"];

  const headers = selectedColumns.map((c: string) => COLUMN_LABELS[c] || c);
  const rows = products.map(p => {
    return selectedColumns.map((col: string) => {
      switch (col) {
        case "collection": return p.plm_collections?.name || "";
        case "factory": return p.factory_catalog?.name || "";
        case "margin":
          if (p.target_elc && p.target_sell_price) {
            return `${Math.round(((p.target_sell_price - p.target_elc) / p.target_sell_price) * 100)}%`;
          }
          return "";
        case "current_stage":
          return p.current_stage?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "";
        case "images":
          return include_images ? (p.images?.[0] || "") : "";
        default:
          return p[col] !== null && p[col] !== undefined ? String(p[col]) : "";
      }
    });
  });

  // Build CSV
  const csv = [headers, ...rows].map(row =>
    row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="product-catalog-${Date.now()}.csv"`,
    },
  });
}
