import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

async function buildPLMContext(userId: string): Promise<string> {
  const [
    { data: products },
    { data: factories },
    { data: tracks },
    { data: collections },
    { data: orders },
  ] = await Promise.all([
    supabaseAdmin.from("plm_products").select("id, name, sku, killed, action_status, action_note, notes, factory_notes, collection_id, plm_collections(name, season, year)").eq("user_id", userId).eq("killed", false),
    supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name").eq("user_id", userId),
    supabaseAdmin.from("plm_factory_tracks").select("id, product_id, factory_id, status, approved_price, factory_catalog(name), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number, notes)").eq("user_id", userId),
    supabaseAdmin.from("plm_collections").select("id, name, season, year").eq("user_id", userId),
    supabaseAdmin.from("plm_batches").select("id, product_id, factory_id, current_stage, order_quantity, factory_catalog(name)").eq("user_id", userId),
  ]);

  const lines: string[] = ["=== PLM DATA ===\n"];

  if (collections?.length) {
    lines.push(`COLLECTIONS (${collections.length}):`);
    collections.forEach((c: any) => {
      const prods = (products || []).filter((p: any) => p.collection_id === c.id);
      lines.push(`  - ${c.name}${c.season ? ` (${c.season} ${c.year})` : ""}: ${prods.length} products`);
    });
    lines.push("");
  }

  if (factories?.length) {
    lines.push(`FACTORIES (${factories.length}):`);
    factories.forEach((f: any) => {
      const ft = (tracks || []).filter((t: any) => t.factory_id === f.id);
      const approved = ft.filter((t: any) => t.status === "approved");
      const active = ft.filter((t: any) => t.status === "active");
      const prices = approved.filter((t: any) => t.approved_price).map((t: any) => t.approved_price);
      const avgPrice = prices.length > 0 ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : null;
      lines.push(`  - ${(f as any).name}: ${approved.length} approved, ${active.length} active${avgPrice ? `, avg $${avgPrice}` : ""}`);
    });
    lines.push("");
  }

  if (products?.length) {
    lines.push(`PRODUCTS (${products.length}):`);
    products.forEach((p: any) => {
      const pt = (tracks || []).filter((t: any) => t.product_id === p.id);
      const approvedTrack = pt.find((t: any) => t.status === "approved");
      const activeTracks = pt.filter((t: any) => t.status === "active");
      lines.push(`\n  ${p.name}${p.sku ? ` (${p.sku})` : ""} — ${p.plm_collections?.name || "No collection"}`);
      if (p.action_status === "action_required") lines.push(`    ⚡ ACTION: ${p.action_note || "needs attention"}`);
      if (approvedTrack) { const aName = (approvedTrack as any).factory_catalog?.name || ""; const aPrice = (approvedTrack as any).approved_price; lines.push(`    ✓ APPROVED: ${aName}${aPrice ? ` @ $${aPrice}` : ""}`); }
      activeTracks.forEach((t: any) => {
        const done = (t.plm_track_stages || []).filter((s: any) => s.status === "done").map((s: any) => s.stage);
        const latest = ["sample_reviewed","sample_arrived","sample_shipped","sample_complete","sample_production","sample_requested","quote_received","quote_requested","artwork_sent"].find(s => done.includes(s));
        const quoted = (t.plm_track_stages || []).find((s: any) => s.stage === "quote_received" && s.quoted_price)?.quoted_price;
        const revs = (t.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
        const tName = (t as any).factory_catalog?.name || "Unknown"; lines.push(`    ${tName}: ${latest || "not started"}${quoted ? ` quoted $${quoted}` : ""}${revs > 0 ? ` (${revs} revision${revs > 1 ? "s" : ""})` : ""}`);
      });
      if (pt.length === 0) lines.push(`    No factory tracks`);
    });
    lines.push("");
  }

  if (orders?.length) {
    lines.push(`ORDERS (${orders.length}):`);
    orders.forEach((o: any) => {
      const p = (products || []).find((pr: any) => pr.id === o.product_id);
      lines.push(`  - ${(p as any)?.name || "Unknown"} @ ${(o as any).factory_catalog?.name}: ${(o as any).order_quantity?.toLocaleString()} units, ${(o as any).current_stage}`);
    });
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history = [] } = await req.json();
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

  const plmContext = await buildPLMContext(user.id);

  const systemPrompt = `You are Jimmy's PLM Agent — a wholesale product lifecycle expert with complete real-time access to all product, factory, sample, and order data.

Answer questions directly using the actual data below. Be specific with names, prices, and numbers. Make clear recommendations when asked. Never say you don't have access to data — you do.

${plmContext}

Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  await trackUsage(user.id, "claude-haiku-4-5-20251001", String(inputTokens), String(outputTokens), "plm_agent");

  const reply = response.content.find((c: any) => c.type === "text")?.text || "";
  return NextResponse.json({ reply });
}
