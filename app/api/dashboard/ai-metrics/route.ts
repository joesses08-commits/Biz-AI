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

    // Try to get Company Brain snapshot first
    const { data: snapshotCache } = await supabaseAdmin
      .from("context_cache")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get recent events for additional context
    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get company profile
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let companyContext = "";

    if (snapshotCache?.context && recentEvents?.length) {
      // Use Company Brain snapshot + recent events (fast and cheap)
      const recentEventsText = recentEvents.map(e =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
${e.analysis}
${e.action_required ? `⚠️ ACTION NEEDED: ${e.recommended_action}` : ""}
${e.dollar_amount ? `💰 $${e.dollar_amount}` : ""}`
      ).join("\n\n");

      companyContext = `COMPANY: ${profile?.company_name || "Unknown"}
CONTEXT: ${profile?.company_brief || ""}

COMPANY BRAIN SNAPSHOT:
${snapshotCache.context}

RECENT EVENTS (last 20):
${recentEventsText}`;

    } else {
      // Fall back to full raw data pull if no snapshot exists yet
      companyContext = await buildFullCompanyContext(user.id);
    }

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: `You are a world-class Chief Operating Officer. Today is ${today}.

You have three jobs:
1. RISK PROTECTOR — Find threats with specific dollar amounts
2. GROWTH ENGINE — Find specific revenue opportunities with dollar amounts  
3. OPERATIONS MANAGER — What needs to happen today, this week, this month

You are reading from an intelligent Company Brain that has already analyzed and connected all business events. Use this to surface deep insights, not just surface-level observations. Connect dots. Note patterns. Flag relationship tone changes. Identify cascading risks.

DATA RULES:
- Note the DATE of data you reference
- Never present old data as current without stating the date
- If action_required events exist, always surface them as risks or operations

CRITICAL: Return ONLY a raw JSON object. No markdown. No backticks. Start with { end with }.

{
  "business_type": "precise description",
  "briefing": "2 sentences max with specific numbers and insights",
  "risks": [
    {
      "title": "short title",
      "detail": "specific insight connecting multiple data points",
      "dollar_impact": "$X,XXX",
      "action": "exact action",
      "urgency": "critical",
      "source": "Gmail",
      "source_detail": "specific email or event"
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
      "source_detail": "specific email or event"
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
  "chart_label": "what this chart shows"
}`,
      messages: [{ role: "user", content: companyContext || "No data available yet. Tell the user to connect their integrations." }],
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

    // Save to dashboard cache
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
