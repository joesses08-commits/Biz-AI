import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { trackUsage } from "@/lib/track-usage";

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

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyContext = `${profile?.company_name || ""}: ${profile?.company_brief || ""}`;

    // Get all summaries from queue for this user
    const { data: allRows } = await supabaseAdmin
      .from("backfill_queue")
      .select("item_data")
      .eq("user_id", user.id);

    const emailTexts = (allRows || [])
      .map((r: any) => r.item_data?.summary)
      .filter((s: any) => s && typeof s === "string" && s.length > 0);

    if (!emailTexts.length) {
      return NextResponse.json({ error: "No email summaries found in queue" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: `You are a Chief Operating Officer building an intelligent knowledge base about a business from their historical data.

Read all the data carefully and write a comprehensive, specific summary that captures:
- Key clients, partners, vendors — who they are and the relationship status
- Financial patterns — revenue trends, outstanding amounts, payment behavior
- Ongoing deals, projects, or negotiations — status and next steps
- Recurring themes, problems, or opportunities
- Important people and their roles in the business
- Any urgent or unresolved items

Be SPECIFIC — use real names, real amounts, real dates. This summary will be the AI COO's permanent knowledge base.
Write in flowing paragraphs, not bullet points.`,
      messages: [{
        role: "user",
        content: `COMPANY: ${companyContext}
SOURCE: Gmail

DATA (${emailTexts.length} important emails from last 12 months):
${emailTexts.join("\n").slice(0, 10000)}

Write the knowledge summary now.`
      }],
    });

    trackUsage(user.id, "snapshot", "claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
    const brainSection = response.content[0].type === "text" ? response.content[0].text : "";

    if (brainSection) {
      const existingBrain = profile?.company_brain || "";
      await supabaseAdmin.from("company_profiles").upsert({
        user_id: user.id,
        company_brain: existingBrain + "\n\n=== GMAIL HISTORY ===\n" + brainSection,
        updated_at: new Date().toISOString(),
      });

      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, emailsAnalyzed: emailTexts.length });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
