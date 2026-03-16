import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const userId = await getUserId();

  const { data: conn } = await supabase
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!conn) return NextResponse.json({ connected: false });

  const headers = {
    Authorization: `Bearer ${conn.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    const [emailsRes, eventsRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,bodyPreview", { headers }),
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
  } catch {
    return NextResponse.json({ connected: true, email: conn.email, emails: [], events: [] });
  }
}
