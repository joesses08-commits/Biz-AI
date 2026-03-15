import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data: conn } = await supabase
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", "demo-user")
    .single();

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  const headers = {
    Authorization: `Bearer ${conn.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    const [emailsRes, eventsRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,bodyPreview", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/events?$top=5&$orderby=start/dateTime&$select=subject,start,end,organizer", { headers }),
    ]);

    const emails = await emailsRes.json();
    const events = await eventsRes.json();

    return NextResponse.json({
      connected: true,
      email: conn.email,
      displayName: conn.display_name,
      emails: emails.value || [],
      events: events.value || [],
    });
  } catch (error) {
    return NextResponse.json({ connected: true, email: conn.email, emails: [], events: [] });
  }
}
