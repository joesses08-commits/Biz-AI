import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { buildFullCompanyContext } from "@/lib/company-context";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Return cached dashboard if it exists — only busted when important events arrive
    const { data: cached } = await supabase
      .from("dashboard_cache")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (cached?.response) {
      return NextResponse.json({ ...cached.response, _cached: true });
    }

    // No cache — build fresh from snapshot
    const { data: snapshot } = await supabaseAdmin
      .from("context_cache")
      .select("context, cached_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let companyContext = "";

    if (snapshot?.context && snapshot.context.length > 200) {
      const recentEventsText = (recentEvents || []).map((e: any) =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
${e.analysis}
${e.action_required ? `⚠️ ACTION: ${e.recommended_action}` : ""}
${e.dollar_amount ? `💰 $${e.dollar_amount}` : ""}
Raw: ${(e.raw_data || "").slice(0, 200)}`
      ).join("\n\n");

      companyContext = `COMPANY: ${profile?.company_name || "Unknown"}
CONTEXT: ${profile?.company_brief || ""}
${profile?.company_brain ? `\nKNOWLEDGE:\n${profile.company_brain}` : ""}

BRAIN SNAPSHOT (${snapshot.cached_at ? new Date(snapshot.cached_at).toLocaleString() : "unknown"}):
${snapshot.context}

RECENT EVENTS:
${recentEventsText}`;
    } else {
      companyContext = await buildFullCompanyContext(user.id);
    }

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: `You are a world-class Chief Operating Officer. Today is ${today}.

You have full access to this person's Company Brain. Your job is to present the most important intelligence clearly.

HOW TO THINK:
1. WHY is this happening? Understand cause before judging symptom.
2. IS THIS TEMPORARY OR STRUCTURAL? Temporary = monitor. Structural = act.
3. DOES MY ADVICE MATCH THEIR ACTUAL GOAL? Read the data to understand what they're trying to achieve.
4. WHAT DECISION NEEDS TO BE MADE RIGHT NOW? Only surface what requires real action.

HOW TO ANALYZE:
- Compare current to historical — never present a number in isolation
- Connect dots across sources — the best insights combine things that seem unrelated
- Understand tone and relationships — emails tell you why, numbers tell you what

OUTPUT FORMAT — Return ONLY raw JSON. No markdown. No backticks. Start with { end with }.

{
  "business_type": "precise description of ALL their ventures and current phase",
  "briefing": "2-3 sentences. Most important thing happening right now with specific numbers. What changed. What needs a decision today.",
  "risks": [
    {
      "title": "short specific title",
      "detail": "What is happening and why it is a risk.",
      "dollar_impact": "$X,XXX at risk",
      "action": "Specific action",
      "urgency": "critical or high or medium",
      "source": "source name",
      "source_detail": "specific email subject, file name, or transaction"
    }
  ],
  "opportunities": [
    {
      "title": "short specific title",
      "detail": "What the opportunity is and why now.",
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
      "sub": "Context: change vs historical",
      "trend": "up or down or neutral",
      "category": "revenue or cash or customers or operations or activity"
    }
  ],
  "top_items": [
    {
      "type": "stock or customer or invoice or deal or task",
      "label": "specific name",
      "value": "dollar amount or key metric",
      "status": "good or warning or urgent or neutral"
    }
  ],
  "chart_data": [
    { "label": "specific date or period", "value": 0 }
  ],
  "chart_label": "What this chart shows and why it matters"
}`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    trackUsage(user.id, "dashboard", "claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});

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
