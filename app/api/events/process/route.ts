import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { trackUsage } from "@/lib/track-usage";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // DISABLED - old vision feature
  return Response.json({ success: true, skipped: true });
  try {
    const { userId, source, eventType, rawData, companyContext } = await request.json();
    if (!userId || !source || !rawData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use haiku for individual event analysis — cheap and fast
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system: `You are a business analyst. Analyze this business event quickly and extract key intelligence.

Return ONLY raw JSON, no markdown, start with {:
{
  "summary": "1-2 sentence intelligent summary connecting this to business context",
  "tone": "positive/negative/neutral/urgent/concerning",
  "intent": "what the person or system actually wants",
  "importance": "critical/high/normal/low",
  "action_required": true/false,
  "recommended_action": "specific action to take or null",
  "business_impact": "what this means for the business",
  "people_involved": ["name1"],
  "dollar_amount": 0
}`,
      messages: [{
        role: "user",
        content: `COMPANY: ${companyContext?.slice(0, 800) || "No context"}

EVENT:
Source: ${source}
Type: ${eventType}
Data: ${rawData.slice(0, 1500)}`
      }],
    });

    trackUsage(userId, "event_processor", "claude-haiku-4-5-20251001", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const jsonStr = raw.slice(firstBrace, lastBrace + 1);

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { summary: raw.slice(0, 200), tone: "neutral", importance: "normal", action_required: false };
    }

    // Skip low importance entirely — don't store, don't process
    if (analysis.importance === "low") {
      return NextResponse.json({ success: true, skipped: true, reason: "low_importance" });
    }

    const { data: event, error } = await supabase.from("company_events").insert({
      user_id: userId,
      source,
      event_type: eventType,
      raw_data: rawData.slice(0, 1500),
      analysis: analysis.summary,
      tone: analysis.tone,
      intent: analysis.intent,
      importance: analysis.importance,
      action_required: analysis.action_required,
      recommended_action: analysis.recommended_action,
      business_impact: analysis.business_impact,
      people_involved: analysis.people_involved || [],
      dollar_amount: analysis.dollar_amount || null,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, event, analysis });
  } catch (err) {
    console.error("Event processor error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
