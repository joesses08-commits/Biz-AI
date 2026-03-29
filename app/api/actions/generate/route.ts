import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST() {
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

    // Read from Company Brain snapshot
    const { data: snapshot } = await adminSupabase
      .from("context_cache")
      .select("context")
      .eq("user_id", user.id)
      .single();

    // Get action-required events
    const { data: actionEvents } = await adminSupabase
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("action_required", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: profile } = await adminSupabase
      .from("company_profiles")
      .select("company_name, company_brief")
      .eq("user_id", user.id)
      .single();

    const actionEventsText = actionEvents?.length
      ? `\n\nACTIONS REQUIRED FROM EVENTS:\n${actionEvents.map(e =>
          `- [${e.source}] ${e.analysis}\n  Recommended: ${e.recommended_action}\n  Impact: ${e.business_impact}`
        ).join("\n\n")}`
      : "";

    const context = (snapshot?.context || profile?.company_brief || "") + actionEventsText;
    const today = new Date().toISOString().split("T")[0];

    // Use claude-haiku for cost savings
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a COO extracting action items from business data. Today is ${today}.

Extract 5-8 specific, actionable items that need attention. Each must be something concrete that can actually be done.

RULES:
- Prioritize any action_required events first
- Include the specific dollar amount when relevant
- Name specific people, customers, or platforms involved
- Be specific about what needs to happen
- Include due dates when time-sensitive
- Do NOT include vague items like "review business strategy"

Return ONLY raw JSON, no markdown:
{
  "items": [
    {
      "title": "short action title",
      "detail": "specific detail with dollar amounts and names",
      "priority": "critical | high | medium | low",
      "due_date": "YYYY-MM-DD or null",
      "people_involved": ["name1", "name2"],
      "source": "email | dashboard | ai",
      "steps": [
        { "text": "specific step 1" },
        { "text": "specific step 2" }
      ]
    }
  ]
}`,
      messages: [{ role: "user", content: context || "No data connected." }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonStr = firstBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch { return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 }); }

    const items = parsed.items || [];
    const inserted = [];

    for (const item of items) {
      const { data } = await adminSupabase.from("action_items").insert({
        user_id: user.id,
        title: item.title,
        detail: item.detail,
        priority: item.priority || "medium",
        due_date: item.due_date || null,
        people_involved: item.people_involved || [],
        source: item.source || "ai",
        steps: (item.steps || []).map((s: any) => ({ id: Math.random().toString(36).slice(2), text: s.text, done: false })),
        progress: 0,
        status: "active",
      }).select().single();
      if (data) inserted.push(data);
    }

    return NextResponse.json({ items: inserted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
