import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getGoogleToken(userId: string, supabase: any) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).single();
  if (!conn) return null;
  let token = conn.access_token;
  if (new Date(conn.token_expiry) < new Date()) {
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
      token = data.access_token;
      await supabase.from("gmail_connections").update({
        access_token: token,
        token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
    }
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, eventId, title, description, startTime, endTime, attendees, location } = await req.json();
    const token = await getGoogleToken(user.id, supabase);
    if (!token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    const eventBody = {
      summary: title,
      description,
      location,
      start: { dateTime: startTime, timeZone: "America/New_York" },
      end: { dateTime: endTime, timeZone: "America/New_York" },
      attendees: (attendees || []).map((email: string) => ({ email })),
    };

    // CREATE event
    if (action === "create") {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true, eventId: data.id, url: data.htmlLink });
    }

    // UPDATE event
    if (action === "update") {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // DELETE event
    if (action === "delete") {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action. Use: create, update, delete" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
