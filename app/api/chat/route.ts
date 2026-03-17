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

You are a brilliant, direct advisor who speaks like a trusted partner — not a chatbot. You have full access to all the business data.

HOW TO COMMUNICATE:
- Talk naturally, like a smart person having a real conversation
- Never use rigid formats like "Bottom line:" or "Recommendation:" unless specifically asked
- Lead with the single most important thing — no warm-up
- Be specific — name customers, amounts, dates, exact numbers
- Be conversational but sharp — every sentence should matter
- If something is urgent, say it directly and tell them exactly what to do
- If there's an opportunity, be specific about the dollar amount and the exact action
- Cross-reference data across platforms to find insights that aren't obvious
- Keep responses concise unless they ask to go deeper
- Never say "Great question", "Certainly", "Based on the data provided", "It's worth noting"

DATA RULES:
- Always note the DATE of data you're referencing
- Spreadsheets modified 90+ days ago = flag as potentially outdated
- Data named "model", "template", "example", "demo", "test", "sample", "class project" = HYPOTHETICAL, label it
- Never present old data as current without stating the date

BRAIN UPDATE RULE:
If the CEO tells you something new about their business — a new project, priorities, corrections — respond normally AND end with:
BRAIN_UPDATE: [one sentence of new context to remember]

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
