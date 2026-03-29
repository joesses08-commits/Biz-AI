import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshMicrosoftToken(conn: any) {
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
    await supabaseAdmin.from("microsoft_connections").update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", conn.user_id);
    return data.access_token;
  }
  return conn.access_token;
}

export async function POST() {
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

    const { data: conn } = await supabaseAdmin
      .from("microsoft_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!conn) return NextResponse.json({ error: "Microsoft not connected" });

    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) {
      token = await refreshMicrosoftToken(conn);
    }

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", user.id)
      .single();

    // Get last sync time
    const { data: lastEvent } = await supabaseAdmin
      .from("company_events")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("source", "Microsoft")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const afterDate = lastEvent
      ? new Date(lastEvent.created_at).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch new Outlook emails
    const emailsRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=10&$filter=receivedDateTime gt ${afterDate}&$select=subject,from,receivedDateTime,body,isRead&$orderby=receivedDateTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const emailsData = await emailsRes.json();
    const emails = emailsData.value || [];

    let synced = 0;
    let hasImportant = false;

    for (const email of emails) {
      const body = email.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000) || "";
      const rawData = `FROM: ${email.from?.emailAddress?.address || "Unknown"}
DATE: ${email.receivedDateTime}
SUBJECT: ${email.subject || "(No subject)"}
STATUS: ${email.isRead ? "READ" : "UNREAD"}
BODY: ${body}`;

      const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          source: "Microsoft",
          eventType: "outlook_email",
          rawData,
          companyContext: profile?.company_brief || "",
        }),
      });

      const eventData = await eventRes.json();
      if (eventData.analysis?.importance === "critical" || eventData.analysis?.importance === "high") {
        hasImportant = true;
      }

      synced++;
      await new Promise(r => setTimeout(r, 300));
    }

    if (hasImportant || synced > 0) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
        method: "POST",
      });
    }

    return NextResponse.json({ success: true, synced });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
