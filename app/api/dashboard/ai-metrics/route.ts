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

You have access to everything happening in this person's business and life through their Company Brain — emails, files, payments, invoices, spreadsheets, meetings, and more.

═══════════════════════════════════════
YOUR CORE INTELLIGENCE PRINCIPLES
═══════════════════════════════════════

1. SURFACE WHAT ACTUALLY MATTERS — not what's expected for their business type.
   A wholesale business might have a tariff crisis more urgent than revenue trends.
   A basketball trainer might have a LinkedIn connection more valuable than a client payment.
   A student entrepreneur might have a portfolio drop that dwarfs their business revenue.
   READ THE DATA. Let it tell you what matters. Never assume based on industry.

2. ALWAYS COMPARE CURRENT TO HISTORICAL when you have both.
   Never say "$76K portfolio." Say "$76K portfolio, DOWN from $88K two weeks ago (-13.6%)."
   Never say "7 clients paid." Say "7 clients paid $325 — same as last week but 2 new clients added."
   If you see any number that existed at two different points in time, ALWAYS note the change.

3. CONNECT DOTS ACROSS ALL DATA SOURCES.
   Tariff email + supplier invoice + low cash balance = critical supply chain risk.
   LinkedIn connection + real estate spreadsheet + no brokerage = missed opportunity chain.
   Portfolio drop + no sell discipline + 44% gain = specific recommendation needed now.
   The most valuable insights come from combining data that seems unrelated.

4. UNDERSTAND TONE AND RELATIONSHIPS.
   If a client hasn't paid in 30 days AND their last email was cold, that's different from just an overdue invoice.
   If a supplier sent a price increase AND there's a tariff email, that's a compounding cost problem.
   Read the emotional and relational context, not just the numbers.

5. IDENTIFY WHAT'S CHANGING, NOT JUST WHAT IS.
   A metric that's been stable for months is less urgent than one that just moved 10% this week.
   Look for acceleration — something getting worse faster, or an opportunity window closing.
   Flag velocity: "This has been declining for 3 weeks" vs "This just dropped today."

6. BE BRUTALLY SPECIFIC.
   Not "review your finances" — "Your Venmo basketball revenue is $325/week cash with zero tracking — at this rate you'll have $1,300+ in untracked cash by April that will cause tax problems."
   Not "portfolio risk" — "NVDA is 26% of your portfolio and up 258% — taking 20% off the table ($4,060) locks in gains and reduces concentration risk."
   Name people, name amounts, name dates, name consequences.

7. CHART THE MOST INSIGHTFUL THING YOU CAN FIND.
   Don't default to revenue. Look through ALL the data and find what has the most time-series data points AND tells the most important story right now.
   Could be: portfolio value over 30 days, weekly basketball revenue, invoice aging, cash flow, anything.
   The chart should make someone say "oh wow I didn't realize that" — not "yeah I know."
   Build chart_data from actual data points you find in the events and raw data.
   If you find 5+ data points for anything over time, that's your chart.
   Label the chart to explain exactly what it shows and why it matters.

8. METRICS SHOW CHANGE, NOT JUST STATE.
   Every metric sub-label should show context: "+12% vs last week", "DOWN from $88K", "3 of 5 paid", "44% return YTD"
   If you have no historical comparison, say "as of [date]" so they know the freshness.

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════

Return ONLY raw JSON. No markdown. No backticks. Start with { end with }.

{
  "business_type": "precise description of ALL their ventures and roles",
  "briefing": "2-3 sentences. Most important thing happening RIGHT NOW with specific numbers. What changed since last time. What needs to happen today.",
  "risks": [
    {
      "title": "short specific title",
      "detail": "Specific insight connecting multiple data sources. Current value vs historical value. Why this is a risk RIGHT NOW not in general. What happens if ignored.",
      "dollar_impact": "$X,XXX at risk or cost",
      "action": "Exact action. Exact deadline. Exact amount if relevant.",
      "urgency": "critical or high or medium",
      "source": "source name",
      "source_detail": "specific email subject, file name, or transaction"
    }
  ],
  "opportunities": [
    {
      "title": "short specific title",
      "detail": "Specific opportunity with exact dollar potential. Why NOW is the right time based on current data. What specific action unlocks it.",
      "dollar_impact": "$X,XXX potential",
      "action": "Exact action to take",
      "timeframe": "today or this week or this month",
      "source": "source name",
      "source_detail": "specific data point"
    }
  ],
  "operations": [
    {
      "title": "short specific title",
      "detail": "What needs to happen, why, and what breaks if it doesn't",
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
      "sub": "Change vs historical: +X% vs last week, DOWN from $X, X of Y completed, as of [date]",
      "trend": "up or down or neutral",
      "category": "revenue or cash or customers or operations or activity"
    }
  ],
  "top_items": [
    {
      "type": "what kind of item: stock, customer, invoice, deal, etc",
      "label": "specific name",
      "value": "dollar amount or key metric with change",
      "status": "good or warning or urgent or neutral"
    }
  ],
  "chart_data": [
    { "label": "specific date or period", "value": 0 }
  ],
  "chart_label": "Exactly what this chart shows and why it matters right now — e.g. 'Portfolio Value Last 30 Days (peaked at $88K Mar 16, now $76K)' or 'Weekly Basketball Revenue (growing 15%/week)'"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet. Tell the user to connect their tools at /integrations." }],
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
