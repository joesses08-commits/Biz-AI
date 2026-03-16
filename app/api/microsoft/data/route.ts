import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function refreshToken(conn: any, supabase: any) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      scope: "offline_access Mail.Read Calendars.Read Files.Read",
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    await supabase.from("microsoft_connections").update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
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

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ connected: false });

    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshToken(conn, supabase);

    const headers = { Authorization: `Bearer ${token}` };

    // Fetch everything in parallel
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 60);

    const [emailsRes, eventsRes, filesRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,body,bodyPreview", { headers }),
      fetch(`https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$top=50&$select=subject,start,end,organizer,attendees,location,bodyPreview&$orderby=start/dateTime`, { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')?$top=20&$select=id,name,lastModifiedDateTime", { headers }),
    ]);

    const [emailsData, eventsData, filesData] = await Promise.all([
      emailsRes.json(),
      eventsRes.json(),
      filesRes.json(),
    ]);

    const emails = (emailsData.value || []).map((e: any) => ({
      id: e.id,
      subject: e.subject || "(No subject)",
      from: e.from?.emailAddress?.address || "Unknown",
      fromName: e.from?.emailAddress?.name || "",
      date: e.receivedDateTime,
      isUnread: !e.isRead,
      body: e.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) || e.bodyPreview || "",
      snippet: e.bodyPreview || "",
    }));

    const events = (eventsData.value || []).map((e: any) => ({
      id: e.id,
      subject: e.subject || "(No title)",
      start: e.start?.dateTime,
      end: e.end?.dateTime,
      organizer: e.organizer?.emailAddress?.address || "",
      location: e.location?.displayName || "",
      attendees: (e.attendees || []).map((a: any) => a.emailAddress?.address).join(", "),
      notes: e.bodyPreview || "",
    }));

    const excelFiles = (filesData.value || []).filter((f: any) =>
      f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls")
    );

    return NextResponse.json({
      connected: true,
      email: conn.email,
      displayName: conn.display_name,
      emails,
      events,
      excelFiles,
      counts: {
        emails: emails.length,
        events: events.length,
        excelFiles: excelFiles.length,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
