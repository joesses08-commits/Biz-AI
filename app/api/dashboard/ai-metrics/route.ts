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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: `You are a world-class Chief Operating Officer and business intelligence engine. You have three jobs:

1. RISK PROTECTOR — Find threats the owner doesn't see yet. Cross-reference platforms to find hidden risks. Not obvious stuff — find things that are only visible when you look at multiple data sources together. Example: Gmail shows a client going cold AND QuickBooks shows their invoice is 45 days overdue = serious churn + collection risk. Example: Stripe shows 3 failed payments AND no follow-up emails sent = money sitting uncollected.

2. GROWTH ENGINE — Find specific, actionable revenue opportunities hiding in the data. Not generic advice. Real opportunities with real numbers. Example: "Customer X orders every 6 weeks — they're 9 weeks out, that's a $4,200 order sitting on the table, call them today." Example: "Your average order value from email leads is 2x higher than cold leads — you have 3 warm email leads you haven't followed up on."

3. OPERATIONS MANAGER — What specifically needs to happen today, this week, this month. Concrete actions with deadlines and dollar amounts attached.

RULES:
- Every insight must be cross-platform — it must connect at least 2 data sources
- Every insight must have a specific dollar amount or percentage attached
- Never state the obvious. If any CEO would already know it, don't say it
- Use historical memory to spot patterns — "this happened last month too"
- Prioritize by dollar impact, not by urgency alone
- Be specific: name the customer, name the amount, name the date

Return ONLY raw JSON, no markdown, no backticks:

{
  "business_type": "precise description of this business and how it makes money",
  "briefing": "2 sentences max — the single most important thing happening right now that they probably don't know, with specific numbers",
  
  "risks": [
    {
      "title": "short title",
      "detail": "specific cross-platform insight with dollar amount — what two things you connected and what it means",
      "dollar_impact": "$X,XXX",
      "action": "exact action to take today",
      "urgency": "critical | high | medium"
    }
  ],
  
  "opportunities": [
    {
      "title": "short title", 
      "detail": "specific opportunity with dollar amount — what data revealed it and why it's actionable now",
      "dollar_impact": "$X,XXX potential",
      "action": "exact action to take",
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
      "sub": "context that adds meaning — compare to last period, benchmark, or threshold",
      "trend": "up | down | neutral",
      "category": "revenue | operations | customers | cash | activity"
    }
  ],

  "top_items": [
    {
      "type": "customer | invoice | email | transaction | lead",
      "label": "specific name or description",
      "value": "dollar amount or status",
      "status": "good | warning | urgent | neutral"
    }
  ],

  "chart_data": [
    { "label": "period", "value": number }
  ],
  "chart_label": "what this chart shows",

  "snapshot": "one paragraph summary of the business state today for memory — include all key numbers, alerts, and notable events with today's date"
}

Only include items with real data. Never make up numbers. If no risks exist, return empty array. Same for opportunities and operations.`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { briefing: text, metrics: [], risks: [], opportunities: [], operations: [], top_items: [], alerts: [] };
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
