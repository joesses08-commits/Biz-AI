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

async function buildSnapshotForUser(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from("context_cache")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Cooldown: skip Claude if snapshot ran less than 90 minutes ago
  if (existing?.cached_at) {
    const minutesSinceLastRun = (Date.now() - new Date(existing.cached_at).getTime()) / 1000 / 60;
    if (minutesSinceLastRun < 45) {
      return { message: `Snapshot is fresh — skipping`, unchanged: true };
    }
  }

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Blackout: skip snapshot between 12am and 6am Eastern
  const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hourET = nowET.getHours();
  if (hourET >= 0 && hourET < 6) {
    return { message: "Snapshot skipped — overnight blackout (12am-6am ET)", skipped: true };
  }

  // Only read events NEWER than last snapshot — never reprocess old data
  const lastSnapshotAt = existing?.last_snapshot_at
    ? new Date(existing.last_snapshot_at).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newEvents } = await supabaseAdmin
    .from("company_events")
    .select("*")
    .eq("user_id", userId)
    .gt("created_at", lastSnapshotAt)
    .order("created_at", { ascending: false })
    .limit(50);

  // If no new events and snapshot exists, nothing to do
  if (!newEvents?.length && existing?.context) {
    return { message: "No new events — snapshot unchanged", unchanged: true };
  }

  const newEventsText = (newEvents || []).map(e =>
    `[${new Date(e.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}] ${e.source} — ${e.event_type}
Summary: ${e.analysis}
Importance: ${e.importance} | Action needed: ${e.action_required}
${e.recommended_action ? `Action: ${e.recommended_action}` : ""}
${e.dollar_amount ? `Amount: $${e.dollar_amount}` : ""}
Raw: ${(e.raw_data || "").slice(0, 300)}`
  ).join("\n\n");

  const snapshotResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: `You are a Chief Operating Officer maintaining an intelligent business snapshot.

You have an existing snapshot and new events just came in. Your job is to update the snapshot intelligently:

RULES:
- Keep everything from the existing snapshot that is still relevant or unresolved
- Add new important information from the new events
- Remove or mark resolved anything that has been addressed
- Never shrink the snapshot just because time passed — only remove things that are truly resolved or irrelevant
- Keep specific names, amounts, dates — never generalize
- Prioritize by business impact, not by recency
- If something critical is still unresolved from last week, it stays at the top
- Write in plain english, like a smart COO briefing

The snapshot should always reflect the TRUE current state of the business — not just what happened recently.`,
    messages: [{
      role: "user",
      content: `COMPANY: ${profile?.company_name || "Unknown"}
CONTEXT: ${profile?.company_brief || ""}
${profile?.company_brain ? `ACCUMULATED KNOWLEDGE:\n${profile.company_brain.slice(0, 500)}` : ""}

EXISTING SNAPSHOT (keep what's still relevant):
${existing?.context || "No existing snapshot — build from scratch."}

NEW EVENTS SINCE LAST SNAPSHOT:
${newEventsText || "No new events."}

Update the snapshot now. Keep unresolved items. Add new important items. Remove only what's truly resolved.`
    }],
  });

  trackUsage(userId, "snapshot", "claude-haiku-4-5-20251001", snapshotResponse.usage.input_tokens, snapshotResponse.usage.output_tokens).catch(() => {});

  const snapshot = snapshotResponse.content[0].type === "text" ? snapshotResponse.content[0].text : "";

  const now = new Date().toISOString();

  await supabaseAdmin.from("context_cache").upsert({
    user_id: userId,
    context: snapshot,
    cached_at: now,
    last_snapshot_at: now,
  });

  // Only bust dashboard cache if new events were important
  const hasImportant = (newEvents || []).some(e =>
    e.importance === "critical" || e.importance === "high"
  );

  if (hasImportant) {
    await supabaseAdmin.from("dashboard_cache").delete().eq("user_id", userId);
  }

  return { success: true, newEventsProcessed: newEvents?.length || 0, importantEvents: hasImportant };
}

export async function POST(request: NextRequest) {
  try {
    const headerUserId = request.headers.get("x-user-id");

    if (headerUserId) {
      const result = await buildSnapshotForUser(headerUserId);
      return NextResponse.json(result);
    }

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
