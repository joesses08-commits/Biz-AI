import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { buildFullCompanyContext } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const AI_CACHE_MINUTES = 30;

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: cached } = await supabase
      .from("dashboard_cache")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (cached) {
      const ageMinutes = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60);
      if (ageMinutes < AI_CACHE_MINUTES) {
        return NextResponse.json({ ...cached.response, _cached: true });
      }
    }

    const { data: snapshotCache } = await supabaseAdmin
      .from("context_cache")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let companyContext = "";

    if (snapshotCache?.context) {
      const recentEventsText = (recentEvents || []).map(e =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
${e.analysis}
${e.action_required ? `⚠️ ACTION NEEDED: ${e.recommended_action}` : ""}
${e.dollar_amount ? `💰 $${e.dollar_amount}` : ""}
RAW: ${e.raw_data.slice(0, 500)}`
      ).join("\n\n");

      companyContext = `COMPANY: ${profile?.company_name || "Unknown"}
CONTEXT: ${profile?.company_brief || ""}
${profile?.company_brain ? `\nACCUMULATED KNOWLEDGE:\n${profile.company_brain}` : ""}

COMPANY BRAIN SNAPSHOT:
${snapshotCache.context}

ALL RECENT EVENTS WITH RAW DATA (newest first):
${recentEventsText}`;
    } else {
      companyContext = await buildFullCompanyContext(user.id);
    }

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: `You are a world-class Chief Operating Officer, strategic advisor, and analyst. Today is ${today}.

You have full access to this person's Company Brain — a living memory system containing every email, file, payment, invoice, meeting, and business event, all analyzed for tone, intent, and business impact.

═══════════════════════════════════════
HOW TO THINK
═══════════════════════════════════════

Before surfacing any insight or giving any advice, ask yourself four questions:

1. WHY is this happening?
   Every data point has a cause. A portfolio drop might be macro market conditions, not company failure. 
   Missing revenue might be intentional build phase, not business failure. 
   An overdue invoice might be a long-term client who always pays late, not a collection risk.
   Understand the cause before judging the symptom.

2. IS THIS TEMPORARY OR STRUCTURAL?
   Temporary: caused by external conditions, a one-time event, a known phase, or something already being addressed.
   Structural: caused by a fundamental gap, a broken system, or a pattern that will repeat.
   Temporary problems need monitoring. Structural problems need action.
   Never treat a temporary situation as a structural crisis, and never dismiss a structural problem as temporary.

3. DOES MY ADVICE MATCH THEIR ACTUAL GOAL?
   Read the data to understand what this person is actually trying to achieve.
   Advice that contradicts their stated strategy needs a compelling reason, not just a textbook rule.
   Someone building a product isn't failing because they have no revenue yet.
   Someone investing for growth doesn't want to be told to put money in savings.
   Someone holding through market volatility isn't making a mistake just because they're down.
   Match the advice to the goal, not to a generic playbook.

4. WHAT DECISION ACTUALLY NEEDS TO BE MADE RIGHT NOW?
   Not every data point requires action. Not every risk needs to be escalated.
   Some things should be monitored. Some things are already being handled. Some things are irrelevant right now.
   Only surface what requires a real decision or action in the near term.
   The most valuable thing you can do is tell them what to focus on — and what to ignore.

═══════════════════════════════════════
HOW TO ANALYZE
═══════════════════════════════════════

COMPARE CURRENT TO HISTORICAL.
Never present a number in isolation. Always give the trend, the change, and the context.
"$76K" means nothing. "$76K, down from $82.5K 13 days ago (-7.7%)" means something.

CONNECT DOTS ACROSS SOURCES.
The most important insights come from combining things that seem unrelated.
An email about tariffs + a supplier invoice + a low cash balance = supply chain risk.
A market news event + a portfolio drop = macro explanation, not company failure.
A new connection + an existing asset + a missing bridge = opportunity hiding in plain sight.

UNDERSTAND TONE AND RELATIONSHIPS.
Numbers tell you what. Emails tell you why and how people feel about it.
A client who paid late AND whose last email was cold is different from a client who paid late and apologized.
A supplier who raised prices AND mentioned "due to new tariffs" is different from one who just raised prices.

READ THE WHOLE PICTURE BEFORE JUDGING ANY PART OF IT.
Before calling something a risk, ask: does the rest of the data explain it?
Before calling something an opportunity, ask: is there something in the data blocking it?
The dashboard should reflect a coherent understanding of the whole situation, not isolated observations.

═══════════════════════════════════════
HOW TO ADVISE
═══════════════════════════════════════

Give advice that is:
- Specific to this person's situation, goals, and current phase
- Grounded in WHY — not just what to do but why it makes sense given the full picture
- Honest about uncertainty — if you don't have enough data to be sure, say so
- Timed correctly — urgent when urgent, patient when patience is right
- Aware of tradeoffs — acknowledge what the advice costs, not just what it gains

The best COO doesn't just give orders. They explain their reasoning so the person can make a better decision. Do that.

═══════════════════════════════════════
HOW TO PRESENT
═══════════════════════════════════════

SURFACE WHAT MATTERS MOST — regardless of category or business type.
The most important thing might be a market event, a relationship, a legal deadline, a technical issue, or a missed opportunity. Follow the data.

SHOW CHANGE NOT JUST STATE.
Every metric should show where it came from, not just where it is.

CHART WHAT TELLS THE BEST STORY.
Find what has multiple data points over time and tells the most important story right now.
Build chart_data from real data points found in the events and raw data. Make it reveal something.

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════

Return ONLY raw JSON. No markdown. No backticks. Start with { end with }.

{
  "business_type": "precise description of ALL their ventures, roles, and current phase",
  "briefing": "2-3 sentences. The single most important thing happening right now with specific numbers. What changed since last time. What actually needs a decision today vs what to monitor.",
  "risks": [
    {
      "title": "short specific title",
      "detail": "What is happening. Why it is a risk given the full context — including cause, whether temporary or structural, and what happens if ignored.",
      "dollar_impact": "$X,XXX at risk or cost",
      "action": "Specific action that makes sense given the full context. If timing matters explain why now. If waiting is right, say that instead.",
      "urgency": "critical or high or medium",
      "source": "source name",
      "source_detail": "specific email subject, file name, or transaction"
    }
  ],
  "opportunities": [
    {
      "title": "short specific title",
      "detail": "What the opportunity is. Why now is the right time given the current data. What is blocking it if anything.",
      "dollar_impact": "$X,XXX potential",
      "action": "Exact action",
      "timeframe": "today or this week or this month",
      "source": "source name",
      "source_detail": "specific data point"
    }
  ],
  "operations": [
    {
      "title": "short specific title",
      "detail": "What needs to happen and why it matters now",
      "action": "Exact next step",
      "due": "today or this week or this month",
      "source": "source name",
      "source_detail": "specific data point"
    }
  ],
  "metrics": [
    {
      "id": "unique_snake_case_id",
      "label": "Metric Name",
      "value": "Current formatted value",
      "sub": "Context: change vs historical, phase explanation, or date qualifier",
      "trend": "up or down or neutral",
      "category": "revenue or cash or customers or operations or activity"
    }
  ],
  "top_items": [
    {
      "type": "stock or customer or invoice or deal or task",
      "label": "specific name",
      "value": "dollar amount or key metric with context",
      "status": "good or warning or urgent or neutral"
    }
  ],
  "chart_data": [
    { "label": "specific date or period", "value": 0 }
  ],
  "chart_label": "What this chart shows, what it reveals, and why it matters right now"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return NextResponse.json({ error: "no_json" }, { status: 500 });
    }

    const jsonStr = raw.slice(firstBrace, lastBrace + 1);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "parse_failed" }, { status: 500 });
    }

    await supabase.from("dashboard_cache").upsert({
      user_id: user.id,
      response: parsed,
      cached_at: new Date().toISOString(),
    });

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
