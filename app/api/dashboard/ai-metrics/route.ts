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

    const companyContext = await buildFullCompanyContext(user.id);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: `You are a world-class Chief Operating Officer. Today is ${today}.

You have three jobs:
1. RISK PROTECTOR — Find threats with specific dollar amounts
2. GROWTH ENGINE — Find specific revenue opportunities with dollar amounts  
3. OPERATIONS MANAGER — What needs to happen today, this week, this month

DATA RULES:
- Note the DATE of data you reference
- Spreadsheets 90+ days old = flag as potentially outdated
- Data named "demo", "test", "sample", "class project" = HYPOTHETICAL
- Never present old data as current without stating the date

CRITICAL: You MUST return ONLY a raw JSON object. No markdown. No backticks. No code fences. Start your response with { and end with }. Nothing before the { and nothing after the }.

{
  "business_type": "precise description",
  "briefing": "2 sentences max with specific numbers",
  "risks": [
    {
      "title": "short title",
      "detail": "specific insight with dollar amount",
      "dollar_impact": "$X,XXX",
      "action": "exact action",
      "urgency": "critical",
      "source": "Gmail",
      "source_detail": "specific email or file name"
    }
  ],
  "opportunities": [
    {
      "title": "short title",
      "detail": "specific opportunity with dollar amount",
      "dollar_impact": "$X,XXX potential",
      "action": "exact action",
      "timeframe": "today",
      "source": "Stripe",
      "source_detail": "specific transaction or customer"
    }
  ],
  "operations": [
    {
      "title": "short title",
      "detail": "what needs to happen",
      "action": "specific next step",
      "due": "today",
      "source": "Gmail",
      "source_detail": "specific email or file"
    }
  ],
  "metrics": [
    {
      "id": "unique_id",
      "label": "Metric Name",
      "value": "formatted value",
      "sub": "context",
      "trend": "up",
      "category": "revenue"
    }
  ],
  "top_items": [
    {
      "type": "customer",
      "label": "specific name",
      "value": "dollar amount",
      "status": "good"
    }
  ],
  "chart_data": [{ "label": "period", "value": 0 }],
  "chart_label": "what this chart shows",
  "snapshot": "one paragraph summary for memory"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    
    // Find the JSON object — look for first { and last }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    
    if (firstBrace === -1 || lastBrace === -1) {
      return NextResponse.json({ error: "no_json", raw: raw.slice(0, 200) }, { status: 500 });
    }
    
    const jsonStr = raw.slice(firstBrace, lastBrace + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      return NextResponse.json({ error: "parse_failed", sample: jsonStr.slice(0, 200) }, { status: 500 });
    }

    // Save to cache
    await supabase.from("dashboard_cache").upsert({
      user_id: user.id,
      response: parsed,
      cached_at: new Date().toISOString(),
    });

    // Save snapshot to memory
    if (parsed.snapshot) {
      updateCompanyMemory(user.id, `DAILY SNAPSHOT: ${parsed.snapshot}`).catch(() => {});
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
