import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function decodeBase64(str: string) {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch { return ""; }
}

function extractEmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractEmailBody(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function syncUserGmail(userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!conn) return { synced: 0 };

  let accessToken = conn.access_token;
  if (new Date(conn.token_expiry) < new Date()) {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      accessToken = refreshData.access_token;
      await supabaseAdmin.from("gmail_connections").update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
    }
  }

  const { data: lastEvent } = await supabaseAdmin
    .from("company_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("source", "Gmail")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const afterDate = lastEvent
    ? new Date(lastEvent.created_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=after:${afterTimestamp}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();

  if (!listData.messages?.length) return { synced: 0 };

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_brief")
    .eq("user_id", userId)
    .single();

  let synced = 0;
  let hasImportant = false;

  for (const msg of listData.messages) {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      const headers = data.payload?.headers || [];
      const subject = getHeader(headers, "subject") || "(No subject)";
      const from = getHeader(headers, "from") || "Unknown";
      const date = getHeader(headers, "date") || "";
      const body = extractEmailBody(data.payload).slice(0, 1000);
      const isUnread = data.labelIds?.includes("UNREAD") ? "UNREAD" : "READ";

      const rawData = `FROM: ${from}\nDATE: ${date}\nSUBJECT: ${subject}\nSTATUS: ${isUnread}\nBODY: ${body}`;

      const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          source: "Gmail",
          eventType: "email",
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
    } catch { continue; }
  }

  if (hasImportant) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });
  }

  return { synced };
}

export async function GET(request: NextRequest) {
  // Cron job — requires CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabaseAdmin
    .from("gmail_connections")
    .select("user_id");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;
  for (const conn of connections) {
    try {
      const result = await syncUserGmail(conn.user_id);
      totalSynced += result.synced;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, totalSynced });
}

export async function POST(request: NextRequest) {
  // Manual sync — requires user to be identified via header
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const result = await syncUserGmail(userId);
  return NextResponse.json({ success: true, ...result });
}
