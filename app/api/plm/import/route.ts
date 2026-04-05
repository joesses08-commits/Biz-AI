import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

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

// Extract images from Excel zip, map to row numbers using drawing XML anchors
async function extractImagesFromExcel(base64: string): Promise<Map<number, Buffer>> {
  const imagesByRow = new Map<number, Buffer>();
  try {
    const JSZip = (await import("jszip")).default;
    const buffer = Buffer.from(base64, "base64");
    const zip = await JSZip.loadAsync(buffer);

    // Get all media files
    const mediaFiles: { name: string; data: Buffer }[] = [];
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith("xl/media/") && !file.dir) {
        const ext = path.split(".").pop()?.toLowerCase();
        if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) {
          const data = await file.async("nodebuffer");
          mediaFiles.push({ name: path.split("/").pop() || "", data });
        }
      }
    }

    if (mediaFiles.length === 0) return imagesByRow;

    // Sort media files by filename
    mediaFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Try to read drawing XML for row anchors
    let rowAnchors: number[] = [];
    const drawingFile = zip.files["xl/drawings/drawing1.xml"];
    if (drawingFile) {
      const xml = await drawingFile.async("string");
      // Extract <xdr:from><xdr:row> values — these are the row anchors (0-indexed)
      const rowRegex = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(xml)) !== null) {
        rowAnchors.push(parseInt(rowMatch[1]));
      }
    }

    // Map images to rows
    mediaFiles.forEach((file, idx) => {
      const row = rowAnchors[idx] !== undefined ? rowAnchors[idx] : idx;
      imagesByRow.set(row, file.data);
    });

  } catch (e) {
    console.error("Image extraction error:", e);
  }
  return imagesByRow;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "map") {
    const { headers, sample_rows } = body;
    const prompt = `You are mapping spreadsheet columns to product fields for a wholesale product catalog system.

Headers found: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sample_rows)}

Map each header to one of these fields (or "ignore" if not relevant):
- name (product name, required)
- sku (product code, item number, SKU)
- description (product description)
- specs (specifications, material, size, color, dimensions, finish)
- category (product category, type)
- collection (collection name, season)
- factory (factory name, supplier, vendor)
- target_elc (cost, ELC, unit cost, FOB price, unit price)
- target_sell_price (sell price, retail price, wholesale price)
- moq (minimum order quantity, MOQ)
- order_quantity (order qty, units, qty requested)
- notes (notes, comments, remarks, lead time)

Important: "Photo", "Image", "Picture" columns should be "ignore". Combine material + size + color into specs if separate.

Respond ONLY with a JSON object like:
{"mappings": {"HEADER": "field_or_ignore"}, "confidence": "high/medium/low", "notes": "any notes"}`;

    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = res.content[0].type === "text" ? res.content[0].text : "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return NextResponse.json(parsed);
  }

  if (action === "import") {
    const { rows, mappings, collection_id, file_base64, header_row_idx = 0 } = body;

    const { data: factories } = await supabaseAdmin.from("factory_catalog").select("id, name").eq("user_id", user.id);
    const { data: collections } = await supabaseAdmin.from("plm_collections").select("id, name").eq("user_id", user.id);

    // Extract images if file provided
    let imagesByRow = new Map<number, Buffer>();
    if (file_base64) {
      imagesByRow = await extractImagesFromExcel(file_base64);
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const excelRow = row["__rowIndex"] ?? (header_row_idx + 1 + i);

      try {
        const product: Record<string, any> = {
          user_id: user.id,
          current_stage: "design_brief",
          stage_updated_at: new Date().toISOString(),
          milestones: {},
          status: "active",
        };

        for (const [header, fieldRaw] of Object.entries(mappings)) {
          const field = fieldRaw as string;
          if (field === "ignore" || !field || header === "__rowIndex") continue;
          const val = (row as Record<string, any>)[header];
          if (val === null || val === undefined || val === "") continue;

          if (field === "target_elc" || field === "target_sell_price") {
            product[field] = parseFloat(String(val).replace(/[^0-9.]/g, "")) || null;
          } else if (field === "moq" || field === "order_quantity") {
            product[field] = parseInt(String(val)) || null;
          } else if (field === "factory") {
            const match = factories?.find(f =>
              f.name.toLowerCase().includes(String(val).toLowerCase()) ||
              String(val).toLowerCase().includes(f.name.toLowerCase())
            );
            if (match) product.factory_id = match.id;
          } else if (field === "collection") {
            if (collection_id) {
              product.collection_id = collection_id;
            } else {
              const match = collections?.find(c => c.name.toLowerCase().includes(String(val).toLowerCase()));
              if (match) product.collection_id = match.id;
            }
          } else if (field === "specs") {
            product[field] = product[field] ? `${product[field]}, ${String(val)}` : String(val);
          } else {
            product[field] = String(val);
          }
        }

        if (collection_id && !product.collection_id) product.collection_id = collection_id;
        if (!product.name) { errors.push(`Row ${i + 1}: missing product name`); continue; }

        const { data, error } = await supabaseAdmin.from("plm_products").insert(product).select().single();
        if (error) { errors.push(`Row ${i + 1}: ${error.message}`); continue; }

        await supabaseAdmin.from("plm_stages").insert({
          product_id: data.id, user_id: user.id,
          stage: "design_brief", notes: "Imported from spreadsheet",
          updated_by: user.email, updated_by_role: "admin",
        });

        // Try to attach image — check current row and adjacent rows
        let imageBuffer: Buffer | undefined;
        for (const rowOffset of [0, -1, 1, -2, 2]) {
          const imgRow = excelRow + rowOffset;
          if (imagesByRow.has(imgRow)) {
            imageBuffer = imagesByRow.get(imgRow);
            imagesByRow.delete(imgRow); // consume so it's not reused
            break;
          }
        }

        if (imageBuffer) {
          try {
            const path = `${user.id}/${data.id}/imported_${Date.now()}.jpg`;
            await supabaseAdmin.storage.from("plm-images").upload(path, imageBuffer, { contentType: "image/jpeg", upsert: false });
            const { data: { publicUrl } } = supabaseAdmin.storage.from("plm-images").getPublicUrl(path);
            await supabaseAdmin.from("plm_products").update({ images: [publicUrl] }).eq("id", data.id);
          } catch (imgErr) {
            console.error("Image upload error:", imgErr);
          }
        }

        created.push(data);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${String(e)}`);
      }
    }

    return NextResponse.json({ success: true, created: created.length, errors, images_attached: created.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
