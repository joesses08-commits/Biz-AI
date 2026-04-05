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

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // Step 1 — map columns using Haiku
  if (action === "map") {
    const { headers, sample_rows } = body;

    const prompt = `You are mapping spreadsheet columns to product fields for a wholesale product catalog system.

Headers found: ${JSON.stringify(headers)}
Sample data (first 3 rows): ${JSON.stringify(sample_rows)}

Map each header to one of these fields (or "ignore" if not relevant):
- name (product name, required)
- sku (product code, item number)
- description (product description)
- specs (specifications, material, size, color, dimensions)
- category (product category, type)
- collection (collection name, season)
- factory (factory name, supplier, vendor)
- target_elc (cost, ELC, unit cost, FOB price)
- target_sell_price (sell price, retail price, wholesale price)
- moq (minimum order quantity)
- order_quantity (order qty, units)
- notes (notes, comments, remarks)

Respond ONLY with a JSON object like:
{
  "mappings": {
    "ORIGINAL_HEADER": "field_name_or_ignore"
  },
  "confidence": "high/medium/low",
  "notes": "any important notes about the mapping"
}`;

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

  // Step 2 — create products from confirmed mappings
  if (action === "import") {
    const { rows, mappings, collection_id, images } = body;

    // Get factories for name matching
    const { data: factories } = await supabaseAdmin
      .from("factory_catalog")
      .select("id, name")
      .eq("user_id", user.id);

    // Get collections for name matching
    const { data: collections } = await supabaseAdmin
      .from("plm_collections")
      .select("id, name")
      .eq("user_id", user.id);

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const product: any = {
          user_id: user.id,
          current_stage: "design_brief",
          stage_updated_at: new Date().toISOString(),
          status: "active",
        };

        // Apply mappings
        for (const [header, field] of Object.entries(mappings)) {
          if (field === "ignore" || !field) continue;
          const val = row[header];
          if (!val && val !== 0) continue;

          if (field === "target_elc" || field === "target_sell_price") {
            product[field] = parseFloat(String(val).replace(/[^0-9.]/g, "")) || null;
          } else if (field === "moq" || field === "order_quantity") {
            product[field] = parseInt(String(val)) || null;
          } else if (field === "factory") {
            // Match factory name to ID
            const match = factories?.find(f => f.name.toLowerCase().includes(String(val).toLowerCase()) || String(val).toLowerCase().includes(f.name.toLowerCase()));
            if (match) product.factory_id = match.id;
          } else if (field === "collection") {
            if (collection_id) {
              product.collection_id = collection_id;
            } else {
              const match = collections?.find(c => c.name.toLowerCase().includes(String(val).toLowerCase()));
              if (match) product.collection_id = match.id;
            }
          } else {
            product[field] = String(val);
          }
        }

        if (!product.name) { errors.push(`Row ${i + 1}: missing product name`); continue; }

        // Attach image if available
        let imageUrl = null;
        if (images && images[i]) {
          const imgBuffer = Buffer.from(images[i], "base64");
          const path = `${user.id}/imports/${Date.now()}_${i}.jpg`;
          await supabaseAdmin.storage.from("plm-images").upload(path, imgBuffer, { contentType: "image/jpeg", upsert: false });
          const { data: { publicUrl } } = supabaseAdmin.storage.from("plm-images").getPublicUrl(path);
          imageUrl = publicUrl;
        }

        if (imageUrl) product.images = [imageUrl];

        const { data, error } = await supabaseAdmin.from("plm_products").insert(product).select().single();
        if (error) { errors.push(`Row ${i + 1}: ${error.message}`); continue; }

        // Log initial stage
        await supabaseAdmin.from("plm_stages").insert({
          product_id: data.id, user_id: user.id,
          stage: "design_brief", notes: "Imported from spreadsheet",
          updated_by: user.email, updated_by_role: "admin",
        });

        created.push(data);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${String(e)}`);
      }
    }

    return NextResponse.json({ success: true, created: created.length, errors });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
