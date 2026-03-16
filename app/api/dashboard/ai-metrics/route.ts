import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFullCompanyContext, updateCompanyMemory } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

    // Check AI response cache first
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

    // Cache miss — call Claude
    const companyContext = await buildFullCompanyContext(user.id);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: `You are a world-class Chief Operating Officer and business intelligence engine. Today is ${today}.

You have three jobs:
1. RISK PROTECTOR — Find threats the owner doesn't see yet. Cross-reference platforms. Every risk needs a specific dollar amount. Never state the obvious.
2. GROWTH ENGINE — Find specific revenue opportunities hiding in the data. Name the customer, the amount, the action. Not generic advice.
3. OPERATIONS MANAGER — What specifically needs to happen today, this week, this month. Concrete actions with deadlines and dollar amounts.

DATA RULES:
- Always note the DATE of data you reference
- Spreadsheets last modified 90+ days ago = flag as potentially outdated
- Data named "model", "template", "example", "demo", "test", "sample", "class project", "hypothetical" = HYPOTHETICAL, label it clearly
- Never present old data as current without stating the date

CRITICAL: You MUST report exact numbers from QuickBooks data. If QuickBooks shows invoices, list them with exact dollar amounts. Never say $0 if QuickBooks has data. Return ONLY a raw JSON object. No markdown. No backticks. No code fences. Start with { and end with }. Nothing before { and nothing after }.

{
  "business_type": "precise description",
  "briefing": "2 sentences max — most important thing right now with specific numbers",
  "risks": [
    {
      "title": "short title",
      "detail": "specific cross-platform insight with dollar amount",
      "dollar_impact": "$X,XXX",
      "action": "exact action to take",
      "urgency": "critical | high | medium"
    }
  ],
  "opportunities": [
    {
      "title": "short title",
      "detail": "specific opportunity with dollar amount",
      "dollar_impact": "$X,XXX potential",
      "action": "exact action",
      "timeframe": "today | this week | this month"
    }
  ],
  "operations": [
    {
      "title": "short title",
      "detail": "what needs to happen and why",
      "action": "specific next step",
      "due": "today | this week | this month"
    }
  ],
  "metrics": [
    {
      "id": "unique_id",
      "label": "Metric Name",
      "value": "formatted value",
      "sub": "context that adds meaning",
      "trend": "up | down | neutral",
      "category": "revenue | operations | customers | cash | activity"
    }
  ],
  "top_items": [
    {
      "type": "customer | invoice | email | transaction | lead",
      "label": "specific name",
      "value": "dollar amount or status",
      "status": "good | warning | urgent | neutral"
    }
  ],
  "chart_data": [{ "label": "period", "value": 0 }],
  "chart_label": "what this chart shows",
  "snapshot": "one paragraph summary of business state today for memory"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonStr = firstBrace !== -1 && lastBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { briefing: "Refresh to load your briefing.", metrics: [], risks: [], opportunities: [], operations: [], top_items: [] };
    }

    // Save AI response to cache
    await supabase.from("dashboard_cache").upsert({
      user_id: user.id,
      response: parsed,
      cached_at: new Date().toISOString(),
    });

    // Save snapshot to memory in background
    if (parsed.snapshot) {
      updateCompanyMemory(user.id, `DAILY SNAPSHOT: ${parsed.snapshot}`).catch(() => {});
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
