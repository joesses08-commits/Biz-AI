import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFullCompanyContext, updateCompanyMemory } from "@/lib/company-context";

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

    // Pull everything from every integration in parallel
    const companyContext = await buildFullCompanyContext(user.id);

    const systemPrompt = `You are the AI COO of this business. You have full access to every piece of data across all connected platforms — emails, financials, invoices, spreadsheets, transactions, and more. You know this business inside and out.

Your communication style:
- Lead with the single most important insight — always first, no warm-up
- Give one clear, specific recommendation
- Be direct and confident. No hedging, no filler
- Keep responses under 5 sentences UNLESS the CEO asks to go deeper
- Always end with: "Want me to go deeper on this?"

Never say: "Great question", "Certainly", "Based on the data provided", "It's important to note", or any warm-up phrase.

Default response format:
**Bottom line:** [one sentence — the most critical thing happening right now]
**Recommendation:** [one specific action to take]
Want me to go deeper on this?

If asked to go deeper, provide full analysis with specific numbers, options, risks, and timelines.

RULES:
- ALWAYS base answers on the live data below
- Reference specific emails, invoices, transactions, and spreadsheet data by name when relevant
- NEVER make up numbers not in the data
- If data is missing from a platform, say exactly what's missing and suggest connecting it
- You remember everything — reference past conversations and patterns when relevant
${companyContext || "\n\nNo integrations connected yet. Tell the CEO to connect their tools at /integrations."}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Save insight to memory in background
    if (text) {
      updateCompanyMemory(user.id, `Q: ${messages[messages.length - 1]?.content} | A: ${text.slice(0, 300)}`).catch(() => {});
    }

    return NextResponse.json({ message: text });
  } catch (err) {
    return NextResponse.json({ error: "Failed to process request", details: String(err) }, { status: 500 });
  }
}
