import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, source, eventType, rawData, companyContext } = await request.json();
    if (!userId || !source || !rawData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: `You are an expert business analyst. Analyze this business event and extract deep intelligence.
      
You must return ONLY a raw JSON object. No markdown. No backticks. Start with { end with }.

{
  "summary": "1-2 sentence intelligent summary connecting this to business context",
  "tone": "positive/negative/neutral/urgent/concerning",
  "intent": "what the person/system actually wants or means",
  "importance": "critical/high/normal/low",
  "action_required": true/false,
  "recommended_action": "specific action to take, or null",
  "business_impact": "what this means for the business in plain english",
  "people_involved": ["name1", "name2"],
  "dollar_amount": 0,
  "connections": "how this connects to other business events or patterns"
}`,
      messages: [{
        role: "user",
        content: `COMPANY CONTEXT:
${companyContext || "No company context available"}

NEW EVENT:
Source: ${source}
Type: ${eventType}
Data: ${rawData}`
      }],
    });

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

    const { data: event, error } = await supabase.from("company_events").insert({
      user_id: userId,
      source,
      event_type: eventType,
      raw_data: rawData,
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
