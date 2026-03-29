import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function buildSnapshotForUser(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("company_events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!events?.length) return { message: "No events to snapshot yet" };

  const eventsText = events.map(e =>
    `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}
Summary: ${e.analysis}
Tone: ${e.tone} | Importance: ${e.importance} | Action needed: ${e.action_required}
${e.recommended_action ? `Recommended: ${e.recommended_action}` : ""}
${e.business_impact ? `Impact: ${e.business_impact}` : ""}
${e.dollar_amount ? `Amount: $${e.dollar_amount}` : ""}`
  ).join("\n\n");

  const snapshotResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    system: `You are a Chief Operating Officer writing an intelligent business snapshot.
Read all recent events and write a comprehensive analysis that:
- Connects related events together and identifies patterns
- Flags what needs immediate attention with specific actions
- Notes the emotional tone of customer and partner relationships
- Highlights financial implications and opportunities
- Suggests specific next steps
- Connects dots that aren't obvious from individual events

Write in plain english like a smart COO briefing. Be specific, not generic. Name people, amounts, and dates.`,
    messages: [{
      role: "user",
      content: `COMPANY: ${profile?.company_name || "Unknown"}
CONTEXT: ${profile?.company_brief || "No context"}

RECENT EVENTS (last 7 days):
${eventsText}

Write the snapshot now.`
    }],
  });

  const snapshot = snapshotResponse.content[0].type === "text" ? snapshotResponse.content[0].text : "";

  await supabaseAdmin.from("context_cache").upsert({
    user_id: userId,
    context: snapshot,
    cached_at: new Date().toISOString(),
  });

  await supabaseAdmin.from("dashboard_cache").delete().eq("user_id", userId);

  return { success: true, snapshot };
}

export async function POST(request: NextRequest) {
  try {
    // Check for user ID in header first (called from sync routes)
    const headerUserId = request.headers.get("x-user-id");

    if (headerUserId) {
      const result = await buildSnapshotForUser(headerUserId);
      return NextResponse.json(result);
    }

    // Otherwise use cookies (called from dashboard)
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

    const result = await buildSnapshotForUser(user.id);
    return NextResponse.json(result);

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
