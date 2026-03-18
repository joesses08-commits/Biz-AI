import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function refreshGoogleToken(conn: any) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    await adminSupabase.from("gmail_connections").update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", conn.user_id);
    return data.access_token;
  }
  return conn.access_token;
}

export async function GET() {
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

    const { data: meetings } = await supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    return NextResponse.json({ meetings: meetings || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const { transcript, title, source, drive_file_id } = await request.json();
    if (!transcript) return NextResponse.json({ error: "No transcript provided" }, { status: 400 });

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Process transcript with Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: `You are analyzing a meeting transcript. Extract structured information. Today is ${today}.

Return ONLY raw JSON, no markdown:
{
  "title": "meeting title if not provided",
  "date": "ISO date string of when meeting happened",
  "duration_minutes": estimated duration as number,
  "participants": ["name1", "name2"],
  "summary": "2-3 sentence summary of what was discussed and decided",
  "decisions": ["decision 1", "decision 2"],
  "action_items": [
    {
      "title": "specific action item",
      "detail": "more context",
      "assigned_to": "person name or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "critical | high | medium | low"
    }
  ],
  "key_topics": ["topic 1", "topic 2"]
}`,
      messages: [{ role: "user", content: `Meeting Title: ${title || "Unknown"}\n\nTranscript:\n${transcript.slice(0, 8000)}` }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonStr = firstBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch { return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 }); }

    // Save meeting to database
    const { data: meeting } = await supabase.from("meetings").insert({
      user_id: user.id,
      title: title || parsed.title || "Meeting",
      date: parsed.date || new Date().toISOString(),
      duration_minutes: parsed.duration_minutes || null,
      participants: parsed.participants || [],
      summary: parsed.summary || "",
      decisions: parsed.decisions || [],
      action_items_extracted: parsed.action_items || [],
      raw_transcript: transcript.slice(0, 50000),
      source: source || "manual",
      drive_file_id: drive_file_id || null,
    }).select().single();

    // Auto-add action items to Action Tracker
    const actionItems = parsed.action_items || [];
    for (const item of actionItems) {
      await adminSupabase.from("action_items").insert({
        user_id: user.id,
        title: item.title,
        detail: `${item.detail || ""} [From meeting: ${title || parsed.title}]`,
        priority: item.priority || "medium",
        due_date: item.due_date || null,
        people_involved: item.assigned_to ? [item.assigned_to] : [],
        source: "email",
        steps: [],
        progress: 0,
        status: "active",
      });
    }

    // Save to company memory
    if (parsed.summary) {
      const memoryEntry = `MEETING [${parsed.date || today}]: "${title || parsed.title}" — ${parsed.summary}. Decisions: ${(parsed.decisions || []).join("; ")}. Action items: ${actionItems.length} items created.`;
      const { data: existing } = await adminSupabase.from("company_memory").select("memory").eq("user_id", user.id).single();
      const current = existing?.memory || "";
      await adminSupabase.from("company_memory").upsert({
        user_id: user.id,
        memory: (current + `\n[${new Date().toISOString()}] ${memoryEntry}`).slice(-15000),
        last_updated: new Date().toISOString(),
      });
    }

    return NextResponse.json({ meeting, action_items_created: actionItems.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
