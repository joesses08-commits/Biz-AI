import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { updateCompanyBrain } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
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

    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Get company profile
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Get Company Brain snapshot
    const { data: snapshot } = await supabaseAdmin
      .from("context_cache")
      .select("context, cached_at")
      .eq("user_id", user.id)
      .single();

    // Get recent events — including raw data for specific questions
    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get action-required events
    const { data: actionEvents } = await supabaseAdmin
      .from("company_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("action_required", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Build rich context from Company Brain
    let companyContext = "";

    if (profile) {
      companyContext += `COMPANY: ${profile.company_name || "Unknown"}
FOUNDATION: ${profile.company_brief || "Not set"}
${profile.company_brain ? `ACCUMULATED KNOWLEDGE:\n${profile.company_brain}` : ""}`;
    }

    if (snapshot?.context) {
      const snapshotAge = snapshot.cached_at
        ? `(Updated ${new Date(snapshot.cached_at).toLocaleString()})`
        : "";
      companyContext += `\n\nCOMPANY BRAIN SNAPSHOT ${snapshotAge}:\n${snapshot.context}`;
    }

    if (actionEvents?.length) {
      companyContext += `\n\nACTIONS REQUIRING ATTENTION:\n${actionEvents.map(e =>
        `⚠️ [${e.source}] ${e.analysis}\n   → ${e.recommended_action}\n   Impact: ${e.business_impact}`
      ).join("\n\n")}`;
    }

    if (recentEvents?.length) {
      companyContext += `\n\nRECENT EVENTS (last 50, newest first):\n${recentEvents.map(e =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
Summary: ${e.analysis}
Tone: ${e.tone} | Importance: ${e.importance}
${e.recommended_action ? `Action: ${e.recommended_action}` : ""}
${e.dollar_amount ? `Amount: $${e.dollar_amount}` : ""}
Raw: ${e.raw_data.slice(0, 300)}`
      ).join("\n\n")}`;
    }

    const systemPrompt = `You are the AI COO of this business. Today is ${today}.

You are a brilliant, direct advisor who speaks like a trusted partner — not a chatbot. You have full access to all business data through the Company Brain — a living, intelligent memory system that tracks every email, payment, invoice, and business event with analysis of tone, intent, and business impact.

HOW TO COMMUNICATE:
- Talk naturally, like a smart person having a real conversation
- Never use rigid formats unless specifically asked
- Lead with the single most important thing — no warm-up
- Be specific — name customers, amounts, dates, exact numbers
- Cross-reference events to find non-obvious connections
- If something is urgent, say it directly and tell them exactly what to do
- If there's an opportunity, give the exact dollar amount and action
- Keep responses concise unless they ask to go deeper
- Never say "Great question", "Certainly", "Based on the data provided"
- If asked about a specific email or event, pull from the raw data in recent events

DATA RULES:
- Always note the DATE of data you reference
- Data named "model", "template", "example", "demo", "test" = HYPOTHETICAL
- Never present old data as current without stating the date

BRAIN UPDATE RULE:
If the CEO tells you something new about their business, respond normally AND end with:
BRAIN_UPDATE: [one sentence of new context to remember]

${companyContext || "No integrations connected yet. Tell the CEO to connect their tools at /integrations."}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const fullText = response.content[0].type === "text" ? response.content[0].text : "";

    let displayText = fullText;
    const brainUpdateMatch = fullText.match(/BRAIN_UPDATE:\s*(.+?)$/m);
    if (brainUpdateMatch) {
      displayText = fullText.replace(/\nBRAIN_UPDATE:.+$/m, "").trim();
      updateCompanyBrain(user.id, brainUpdateMatch[1]).catch(() => {});
    }

    return NextResponse.json({ message: displayText });
  } catch (err) {
    return NextResponse.json({ error: "Failed to process request", details: String(err) }, { status: 500 });
  }
}
