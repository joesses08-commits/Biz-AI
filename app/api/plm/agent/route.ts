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
    { data: samples },
  ] = await Promise.all([
    supabaseAdmin.from("plm_products").select("id, name, sku, killed, status, action_status, action_note, notes, factory_notes, collection_id, specs, description, category, plm_collections(name, season, year)").eq("user_id", userId),
    supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name, notes").eq("user_id", userId),
    supabaseAdmin.from("plm_factory_tracks").select("id, product_id, factory_id, status, approved_price, disqualify_reason, disqualified_at, notes, factory_catalog(name), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number, notes)").eq("user_id", userId),
    supabaseAdmin.from("plm_collections").select("id, name, season, year").eq("user_id", userId),
    supabaseAdmin.from("plm_batches").select("id, product_id, factory_id, current_stage, order_quantity, unit_price, elc, sell_price, margin, linked_po_number, payment_terms, factory_catalog(name)").eq("user_id", userId),
    supabaseAdmin.from("plm_sample_requests").select("id, product_id, factory_id, status, round_number, factory_catalog(name), plm_sample_stages(stage, status, actual_date, notes)").eq("user_id", userId),
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

  const allProds = products || [];
  const killed = allProds.filter((p: any) => p.killed || p.status === "killed");
  const active = allProds.filter((p: any) => !p.killed && p.status !== "killed");

  if (active?.length) {
    lines.push(`PRODUCTS (${active.length} active${killed.length > 0 ? `, ${killed.length} killed` : ""}):`);
    active.forEach((p: any) => {
      const pt = (tracks || []).filter((t: any) => t.product_id === p.id);
      const approvedTrack = pt.find((t: any) => t.status === "approved");
      const activeTracks = pt.filter((t: any) => t.status === "active");
      const disqualTracks = pt.filter((t: any) => t.status === "killed");
      const prodSamples = (samples || []).filter((s: any) => s.product_id === p.id);
      const prodOrders = (orders || []).filter((o: any) => o.product_id === p.id);

      lines.push(`\n  ${p.name}${p.sku ? ` (${p.sku})` : ""}${p.status === "hold" ? " [ON HOLD]" : ""} — ${p.plm_collections?.name || "No collection"}`);
      if (p.specs) lines.push(`    Specs: ${p.specs}`);
      if (p.action_status === "action_required") lines.push(`    ⚡ ACTION REQUIRED: ${p.action_note || "needs attention"}`);
      if (p.notes) lines.push(`    Notes: ${p.notes.slice(0, 200)}`);

      if (approvedTrack) {
        const aName = (approvedTrack as any).factory_catalog?.name || "";
        const aPrice = (approvedTrack as any).approved_price;
        lines.push(`    ✓ APPROVED: ${aName}${aPrice ? ` @ $${aPrice}` : ""}`);
      }

      activeTracks.forEach((t: any) => {
        const stages = (t.plm_track_stages || []);
        const done = stages.filter((s: any) => s.status === "done").map((s: any) => s.stage);
        const latest = ["sample_reviewed","sample_arrived","sample_shipped","sample_complete","sample_production","sample_requested","quote_received","quote_requested","artwork_sent"].find(s => done.includes(s));
        const quoted = stages.find((s: any) => s.stage === "quote_received" && s.quoted_price)?.quoted_price;
        const revs = stages.filter((s: any) => s.stage === "revision_requested").length;
        const tNotes = t.notes ? ` | Notes: ${t.notes.slice(0, 100)}` : "";
        // Calculate avg lead time from expected vs actual
        const completedStages = stages.filter((s: any) => s.status === "done" && s.actual_date && s.expected_date);
        const tName = (t as any).factory_catalog?.name || "Unknown";
        lines.push(`    ${tName}: ${latest || "not started"}${quoted ? ` quoted $${quoted}` : ""}${revs > 0 ? ` (${revs} revision${revs > 1 ? "s" : ""})` : ""}${tNotes}`);
      });

      disqualTracks.forEach((t: any) => {
        const tName = (t as any).factory_catalog?.name || "Unknown";
        lines.push(`    ${tName}: DISQUALIFIED (${t.disqualify_reason || "reason unknown"})`);
      });

      prodSamples.forEach((s: any) => {
        const sName = (s as any).factory_catalog?.name || "Unknown";
        const lastStage = (s.plm_sample_stages || []).filter((st: any) => st.status === "done").pop();
        lines.push(`    Sample R${s.round_number} ${sName}: ${s.status}${lastStage ? ` (${lastStage.stage})` : ""}`);
      });

      prodOrders.forEach((o: any) => {
        const oName = (o as any).factory_catalog?.name || "Unknown";
        lines.push(`    Order @ ${oName}: ${o.order_quantity} units, ${o.current_stage}${o.elc ? ` ELC $${o.elc}` : ""}${o.sell_price ? ` sell $${o.sell_price}` : ""}${o.linked_po_number ? ` PO:${o.linked_po_number}` : ""}`);
      });

      if (pt.length === 0 && prodSamples.length === 0) lines.push(`    No factory tracks yet`);
    });
    lines.push("");
  }

  // Factory reliability analysis
  if (factories?.length) {
    lines.push("FACTORY ANALYSIS:");
    (factories || []).forEach((f: any) => {
      const ft = (tracks || []).filter((t: any) => (t as any).factory_catalog?.name === f.name);
      const approved = ft.filter((t: any) => t.status === "approved").length;
      const disqual = ft.filter((t: any) => t.status === "killed").length;
      const quotes = ft.flatMap((t: any) => (t.plm_track_stages || []).filter((s: any) => s.stage === "quote_received" && s.quoted_price)).map((s: any) => s.quoted_price);
      const avgQuote = quotes.length > 0 ? (quotes.reduce((a: number, b: number) => a + b, 0) / quotes.length).toFixed(2) : null;
      const allRevisions = ft.flatMap((t: any) => (t.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested")).length;
      lines.push(`  ${f.name}: ${approved} approved, ${disqual} disqualified${avgQuote ? `, avg quote $${avgQuote}` : ""}${allRevisions > 0 ? `, ${allRevisions} total revisions` : ""}${f.notes ? ` | ${f.notes.slice(0,100)}` : ""}`);
    });
    lines.push("");
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
  await trackUsage(user.id, "plm_agent", "claude-haiku-4-5-20251001", inputTokens, outputTokens);

  const replyBlock = response.content.find((c: any) => c.type === "text") as any;
  const reply = replyBlock?.text || "";
  return NextResponse.json({ reply });
}
