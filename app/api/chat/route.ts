import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { updateCompanyBrain, buildFullCompanyContext } from "@/lib/company-context";
import { trackUsage } from "@/lib/track-usage";
import { checkQuota } from "@/lib/quota";

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

    // Check quota before making AI call
    const quota = await checkQuota(user.id, "chat");
    if (!quota.allowed) {
      return NextResponse.json({
        error: "quota_exceeded",
        reason: quota.reason,
        tokensRemaining: quota.tokensRemaining,
        message: quota.reason === "daily_limit" ? "Daily token limit reached. Adjust your limit in AI Tokens settings." : "Monthly token limit reached. Purchase more tokens to continue."
      }, { status: 402 });
    }

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: snapshot } = await supabaseAdmin
      .from("context_cache")
      .select("context, cached_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("created_at, source, event_type, analysis, tone, importance, recommended_action, dollar_amount, action_required, raw_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    let companyContext = "";

    if (profile) {
      companyContext += `COMPANY: ${profile.company_name || "Unknown"}
FOUNDATION: ${profile.company_brief || ""}
${profile.company_brain ? `KNOWLEDGE:\n${profile.company_brain}` : ""}`;
    }

    // Use snapshot if it has real content, otherwise fall back to live data
    if (snapshot?.context && snapshot.context.length > 200) {
      companyContext += `\n\nBRAIN SNAPSHOT (${snapshot.cached_at ? new Date(snapshot.cached_at).toLocaleString() : "unknown"}):\n${snapshot.context}`;
    } else {
      // Snapshot empty — read live integration data directly (same as dashboard)
      const liveContext = await buildFullCompanyContext(user.id);
      companyContext += `\n\nLIVE BUSINESS DATA:\n${liveContext.slice(0, 2500)}`;
    }

    if (recentEvents?.length) {
      const actionItems = recentEvents.filter((e: any) => e.action_required);
      if (actionItems.length) {
        companyContext += `\n\nURGENT ACTIONS:\n${actionItems.slice(0, 5).map((e: any) =>
          `⚠️ [${e.source}] ${e.analysis} → ${e.recommended_action}`
        ).join("\n")}`;
      }

      companyContext += `\n\nRECENT EVENTS (last 15):\n${recentEvents.map((e: any) =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
${e.analysis}${e.dollar_amount ? ` | $${e.dollar_amount}` : ""}${e.recommended_action ? `\n→ ${e.recommended_action}` : ""}
Raw: ${(e.raw_data || "").slice(0, 120)}`
      ).join("\n\n")}`;
    }

    const systemPrompt = `You are the AI COO of this business. Today is ${today}.

You are a brilliant, direct advisor who speaks like a trusted partner. You have full access to all business data.

HOW TO COMMUNICATE:
- Talk naturally, like a smart person in a real conversation
- Lead with the single most important thing — no warm-up
- Be specific — name customers, amounts, dates, exact numbers
- Cross-reference events to find non-obvious connections
- If something is urgent, say it directly and tell them exactly what to do
- Keep responses tight and punchy — no fluff
- Never say "Great question", "Certainly", "Based on the data provided"

DATA RULES:
- Always note the DATE of data you reference
- Only state numbers you can see in the data — never guess or use memory

BRAIN UPDATE RULE:
If the CEO tells you something new, respond normally AND end with:
BRAIN_UPDATE: [one sentence of new context to remember]

${companyContext || "No integrations connected yet."}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    trackUsage(user.id, "chat", "claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
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
