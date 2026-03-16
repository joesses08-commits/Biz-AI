import { getUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: conn, error } = await supabase
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", await getUserId())
    .single();

  console.log("Microsoft conn:", conn, "error:", error);

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

    console.log("Emails response:", JSON.stringify(emails).slice(0, 200));

    return NextResponse.json({
      connected: true,
      email: conn.email,
      displayName: conn.display_name,
      emails: emails.value || [],
      events: events.value || [],
    });
  } catch (error) {
    console.error("Microsoft Graph error:", error);
    return NextResponse.json({ connected: true, email: conn.email, emails: [], events: [] });
  }
}
