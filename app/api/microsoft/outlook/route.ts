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

    // Fetch inbox + sent emails
    const [inboxRes, sentRes] = await Promise.all([
      fetch(
        "https://graph.microsoft.com/v1.0/me/messages?$top=30&$orderby=receivedDateTime desc&$select=subject,from,toRecipients,receivedDateTime,isRead,body,bodyPreview",
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        "https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$top=20&$orderby=sentDateTime desc&$select=subject,from,toRecipients,sentDateTime,isRead,body,bodyPreview",
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    const inboxData = await inboxRes.json();
    const sentData = await sentRes.json();

    if (inboxData.error) return NextResponse.json({ error: inboxData.error.message }, { status: 400 });

    const mapEmail = (email: any, isSent: boolean) => ({
      id: email.id,
      subject: email.subject || "(No subject)",
      from: email.from?.emailAddress?.address || "Unknown",
      fromName: email.from?.emailAddress?.name || "",
      to: email.toRecipients?.map((r: any) => r.emailAddress?.address).join(", ") || "",
      date: email.receivedDateTime || email.sentDateTime,
      isUnread: isSent ? false : !email.isRead,
      isSent,
      direction: isSent ? "OUTBOUND — user initiated this" : "INBOUND",
      body: email.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || email.bodyPreview || "",
      snippet: email.bodyPreview || "",
    });

    const emails = [
      ...(inboxData.value || []).map((e: any) => mapEmail(e, false)),
      ...(sentData.value || []).map((e: any) => mapEmail(e, true)),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      connected: true,
      email: conn.email,
      emails,
      total: emails.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
