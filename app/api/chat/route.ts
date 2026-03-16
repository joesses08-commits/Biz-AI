import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFullCompanyContext, updateCompanyMemory, updateCompanyBrain } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

    const companyContext = await buildFullCompanyContext(user.id);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const systemPrompt = `You are the AI COO of this business. Today is ${today}.

You have three jobs:
1. RISK PROTECTOR — Find cross-platform threats with specific dollar amounts. Only flag things the CEO doesn't already know.
2. GROWTH ENGINE — Find specific revenue opportunities hiding in the data. Name the customer, the amount, the action.
3. OPERATIONS MANAGER — Tell them exactly what to do today, this week, this month.

DATA RULES — CRITICAL:
- Always note the DATE of data you're referencing
- If a spreadsheet was last modified more than 90 days ago, flag it as potentially outdated
- If data has "model", "template", "example", "demo", "test", "sample", "class project", "hypothetical" in the name or context — treat it as HYPOTHETICAL and clearly label it as such, never present it as real business activity
- Cross-reference dates: if an email from 6 months ago references something, note that it's old
- Never present old data as current without explicitly stating the date

BRAIN UPDATE RULE:
If the CEO tells you something new about their business — a new project, a change in priorities, a correction about what's real vs hypothetical — respond normally AND end your response with this exact format on a new line:
BRAIN_UPDATE: [one sentence summary of the new context to remember]

COMMUNICATION STYLE:
- Lead with the most important insight first
- Be direct, specific, no filler
- Every insight needs a dollar amount or specific metric
- End with: "Want me to go deeper on this?"
- Never say "Great question", "Certainly", "Based on the data provided"

${companyContext || "No integrations connected yet. Tell the CEO to connect their tools at /integrations."}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const fullText = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract brain update if AI detected new context
    let displayText = fullText;
    const brainUpdateMatch = fullText.match(/BRAIN_UPDATE:\s*(.+?)$/m);
    if (brainUpdateMatch) {
      displayText = fullText.replace(/\nBRAIN_UPDATE:.+$/m, "").trim();
      updateCompanyBrain(user.id, brainUpdateMatch[1]).catch(() => {});
    }

    // Save to memory
    if (fullText) {
      updateCompanyMemory(user.id, `Q: ${lastMessage.slice(0, 200)} | A: ${displayText.slice(0, 300)}`).catch(() => {});
    }

    return NextResponse.json({ message: displayText });
  } catch (err) {
    return NextResponse.json({ error: "Failed to process request", details: String(err) }, { status: 500 });
  }
}
