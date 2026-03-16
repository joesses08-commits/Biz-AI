import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFullCompanyContext, updateCompanyMemory } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
- Data named "model", "template", "example", "demo", "test", "sample", "class project", "hypothetical" = HYPOTHETICAL, label it clearly, never present as real activity
- Cross-reference dates — old emails referencing something should be noted as old
- Never present old data as current without stating the date

CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. No code fences. No explanation. Start your response with { and end with }. Nothing before the opening brace, nothing after the closing brace.

The JSON must follow this exact structure:
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
      "detail": "specific opportunity with dollar amount and why it's actionable now",
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
  "chart_data": [
    { "label": "period", "value": 0 }
  ],
  "chart_label": "what this chart shows",
  "snapshot": "one paragraph summary of business state today for memory"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";

    // Aggressively strip any markdown formatting
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Find the first { and last } to extract pure JSON
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonStr = firstBrace !== -1 && lastBrace !== -1
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // If still failing, return a safe fallback with the briefing as text
      parsed = {
        briefing: "Dashboard data loaded — refresh to try again.",
        metrics: [],
        risks: [],
        opportunities: [],
        operations: [],
        top_items: [],
      };
    }

    // Auto-save snapshot to memory
    if (parsed.snapshot) {
      updateCompanyMemory(user.id, `DAILY SNAPSHOT: ${parsed.snapshot}`).catch(() => {});
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
