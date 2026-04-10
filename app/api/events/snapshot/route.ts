import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchPLMData(userId: string): Promise<string> {
  try {
    const { data: snap_ts } = await supabaseAdmin
      .from("context_cache")
      .select("last_snapshot_at")
      .eq("user_id", userId)
      .maybeSingle();
    const changedSince = snap_ts?.last_snapshot_at
      ? new Date(snap_ts.last_snapshot_at).toISOString()
      : new Date(0).toISOString();

    const { data: products } = await supabaseAdmin
      .from("plm_products")
      .select("name, sku, current_stage, status, action_status, plm_collections(name), plm_batches(current_stage, order_quantity, linked_po_number), plm_sample_requests(status, current_stage, factory_catalog(name))")
      .eq("user_id", userId)
      .eq("killed", false)
      .gt("updated_at", changedSince)
      .order("updated_at", { ascending: false });

    const { data: factories } = await supabaseAdmin
      .from("factory_catalog")
      .select("name, email, contact_name")
      .eq("user_id", userId);

    const { data: rfqJobs } = await supabaseAdmin
      .from("factory_quote_jobs")
      .select("job_name, status, created_at, product_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!products?.length && !factories?.length) return "";

    const lines: string[] = ["[SOURCE:PLM]"];
    const byStage: Record<string, string[]> = {};

    for (const p of (products || [])) {
      const stage = p.current_stage || "concept";
      if (!byStage[stage]) byStage[stage] = [];
      const batches = p.plm_batches || [];
      const activeBatch = batches.find((b: any) => b.current_stage !== "shipped");
      const approvedSample = (p.plm_sample_requests || []).find((s: any) => s.status === "approved");
      let line = `  ${p.name}${p.sku ? " (" + p.sku + ")" : ""}`;
      if (activeBatch) line += " | PO: " + (activeBatch.linked_po_number || "pending") + " " + (activeBatch.order_quantity ? activeBatch.order_quantity + "u" : "") + " @ " + activeBatch.current_stage;
      if ((approvedSample as any)?.factory_catalog?.name) line += " | factory: " + (approvedSample as any).factory_catalog.name;
      if (p.action_status === "action_required" && !batches.length) line += " | ACTION NEEDED";
      byStage[stage].push(line);
    }

    for (const [stage, prods] of Object.entries(byStage)) {
      lines.push("  [" + stage + "]");
      prods.forEach(p => lines.push(p));
    }

    if (factories?.length) lines.push("Factories: " + factories.map((f: any) => f.name).join(", "));
    if (rfqJobs?.length) lines.push("RFQs: " + rfqJobs.map((j: any) => j.job_name + " - " + j.status).join(" | "));

    return lines.join("\n");
  } catch { return ""; }
}

async function fetchRecentEvents(userId: string, since: string): Promise<string> {
  const { data: events } = await supabaseAdmin
    .from("company_events")
    .select("created_at, source, event_type, analysis, importance, recommended_action, dollar_amount")
    .eq("user_id", userId)
    .gt("created_at", since)
    .in("importance", ["critical", "high", "normal"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (!events?.length) return "";

  return events.map((e: any) => {
    const date = new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
    return "[" + date + "] [SOURCE:" + e.source + "] " + e.event_type + " | " + e.analysis + (e.dollar_amount ? " | $" + e.dollar_amount : "") + (e.recommended_action ? " -> " + e.recommended_action : "");
  }).join("\n");
}

async function updateSnapshot(userId: string) {
  const { data: existing } = await supabaseAdmin.from("context_cache").select("*").eq("user_id", userId).maybeSingle();
  const { data: profile } = await supabaseAdmin.from("company_profiles").select("company_name, company_brief").eq("user_id", userId).maybeSingle();

  const since = existing?.last_snapshot_at
    ? new Date(existing.last_snapshot_at).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [recentEvents, plmData] = await Promise.all([
    fetchRecentEvents(userId, since),
    fetchPLMData(userId),
  ]);

  if (!recentEvents && !plmData && existing?.snapshot_current) {
    return { message: "No new data", unchanged: true };
  }

  const existingFacts = existing?.snapshot_facts || "";
  const existingHistory = existing?.snapshot_history || "";
  const existingCurrent = existing?.snapshot_current || "";

  // Facts are only updated by the 6am cleaner — not during daily snapshot updates
  const newFacts = existingFacts;

  const currentRes = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: `You maintain the CURRENT section of a wholesale business snapshot. Your job is to take new company events and PLM changes and integrate them into the existing snapshot format.

The snapshot uses this structure:
CURRENT (as of [date]):
  ORDERS: [product] | [status] | [factory] | [date]
  SAMPLES: [product] | [stage] | [factory] | [date]
  PAYMENTS: [amount] | [from/to] | [date] | [status]
  EMAILS: [key supplier/buyer comms] | [date]
  OPEN ITEMS: [what needs action] | [date]

Rules:
- Convert each new event summary into the correct section above using the same format
- Keep all existing unresolved items
- Update existing items if new events show progress
- Remove items only if confirmed resolved
- Last 14 days only
- Straight facts, no narrative, no recommendations
- Max 800 tokens output`,
    messages: [{ role: "user", content: "EXISTING CURRENT:\n" + existingCurrent + "\n\nNEW EVENT SUMMARIES TO INTEGRATE:\n" + (recentEvents || "None") + "\n\nPLM CHANGES SINCE LAST UPDATE:\n" + (plmData || "None") + "\n\nIntegrate new events into the snapshot format. Output the full updated CURRENT section." }],
  });
  trackUsage(userId, "snapshot_current", "claude-haiku-4-5-20251001", currentRes.usage.input_tokens, currentRes.usage.output_tokens).catch(() => {});
  const newCurrent = currentRes.content[0].type === "text" ? currentRes.content[0].text : existingCurrent;

  const combined = newFacts + "\n\n" + existingHistory + "\n\n" + newCurrent;
  const now = new Date().toISOString();

  await supabaseAdmin.from("context_cache").upsert({
    user_id: userId,
    context: combined,
    snapshot_facts: newFacts,
    snapshot_history: existingHistory,
    snapshot_current: newCurrent,
    cached_at: now,
    last_snapshot_at: now,
  });

  return { success: true };
}

async function cleanSnapshot(userId: string) {
  const { data: existing } = await supabaseAdmin.from("context_cache").select("*").eq("user_id", userId).maybeSingle();
  if (!existing) return { message: "Nothing to clean", skipped: true };

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const twoWeeksAgoStr = twoWeeksAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const cleanRes = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 7000,
    system: `You are the daily cleaner for a wholesale business snapshot. The snapshot has grown to ~11,800 tokens overnight and you must compress it back to 7,000 tokens total.

Target structure (7,000 tokens total):
- FACTS: 2,800 tokens (40%) — company, products, factories, collections
- HISTORY: 2,100 tokens (30%) — compressed older events, keep all dates and numbers
- CURRENT: 2,100 tokens (30%) — last 14 days only, full detail

Tasks:
1. Update FACTS with any structural changes visible in CURRENT (new factory, new product stage, new collection)
2. Move items older than 14 days from CURRENT into HISTORY (compressed format)
3. Compress HISTORY by merging duplicate/similar entries — keep dates and numbers, remove repetition
4. History can borrow up to 10% from current allocation if needed (max 2,800 history)

Output format — output ALL THREE sections:
UPDATED_FACTS:
[facts here]

UPDATED_HISTORY:
[compressed history here]

CLEANED_CURRENT:
[last 14 days only here]

Rules:
- Never delete data — only compress and merge
- Keep all dates, names, amounts
- Target total output: 7,000 tokens
- No narrative, straight facts only`,
    messages: [{ role: "user", content: "TODAY: " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + "\n14 DAYS AGO: " + twoWeeksAgoStr + "\n\nCURRENT SECTION:\n" + (existing.snapshot_current || "") + "\n\nEXISTING HISTORY:\n" + (existing.snapshot_history || "") + "\n\nCompress and clean. Output UPDATED_HISTORY and CLEANED_CURRENT." }],
  });

  trackUsage(userId, "snapshot_clean", "claude-haiku-4-5-20251001", cleanRes.usage.input_tokens, cleanRes.usage.output_tokens).catch(() => {});
  const cleanText = cleanRes.content[0].type === "text" ? cleanRes.content[0].text : "";

  const factsMatch = cleanText.match(/UPDATED_FACTS:([\s\S]*?)(?:UPDATED_HISTORY:|$)/);
  const historyMatch = cleanText.match(/UPDATED_HISTORY:([\s\S]*?)(?:CLEANED_CURRENT:|$)/);
  const currentMatch = cleanText.match(/CLEANED_CURRENT:([\s\S]*?)$/);

  const newFacts = factsMatch ? factsMatch[1].trim() : existing.snapshot_facts || "";
  const newHistory = historyMatch ? historyMatch[1].trim() : existing.snapshot_history || "";
  const newCurrent = currentMatch ? currentMatch[1].trim() : existing.snapshot_current || "";
  const combined = newFacts + "\n\n" + newHistory + "\n\n" + newCurrent;
  const now = new Date().toISOString();

  await supabaseAdmin.from("context_cache").upsert({
    user_id: userId,
    context: combined,
    snapshot_facts: newFacts,
    snapshot_history: newHistory,
    snapshot_current: newCurrent,
    cached_at: now,
    last_snapshot_at: existing.last_snapshot_at || now,
    history_cleaned_at: now,
  });

  return { success: true, cleaned: true };
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const action = request.headers.get("x-action");

    if (userId) {
      if (action === "clean") {
        const result = await cleanSnapshot(userId);
        return NextResponse.json(result);
      }
      const result = await updateSnapshot(userId);
      return NextResponse.json(result);
    }

    const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hourET = nowET.getHours();
    if (hourET >= 0 && hourET < 6) {
      return NextResponse.json({ message: "Overnight blackout", skipped: true });
    }

    const { createServerClient } = await import("@supabase/ssr");
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const result = await updateSnapshot(user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Snapshot route active" });
}
