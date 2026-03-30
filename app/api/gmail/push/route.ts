import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bustDashboardCache } from "@/lib/bust-cache";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Decode the Pub/Sub message
    const messageData = body.message?.data;
    if (!messageData) return NextResponse.json({ received: true });

    const decoded = decodeBase64(messageData);
    let notification: any;
    try {
      notification = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ received: true });
    }

    const gmailEmail = notification.emailAddress;
    const historyId = notification.historyId;

    if (!gmailEmail || !historyId) return NextResponse.json({ received: true });

    // Find the user with this Gmail
    const { data: conn } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("email", gmailEmail)
      .single();

    if (!conn) return NextResponse.json({ received: true });

    const userId = conn.user_id;

    // Refresh token if needed
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

    // Get history to find new messages
    const lastHistoryId = conn.last_history_id || historyId;
    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const historyData = await historyRes.json();

    // Update last history ID
    await supabaseAdmin.from("gmail_connections").update({
      last_history_id: historyId,
    }).eq("user_id", userId);

    const messages = historyData.history?.flatMap((h: any) =>
      (h.messagesAdded || []).map((m: any) => m.message)
    ) || [];

    if (!messages.length) return NextResponse.json({ received: true });

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .single();

    // Process each new email
    for (const msg of messages.slice(0, 5)) {
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

        // Skip sent emails
        if (data.labelIds?.includes("SENT")) continue;

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

        // Rebuild snapshot for important emails immediately
        if (eventData.analysis?.importance === "critical" || eventData.analysis?.importance === "high") {
        bustDashboardCache(userId).catch(() => {});
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
          }).catch(() => {});
        }
      } catch { continue; }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Gmail push error:", err);
    return NextResponse.json({ received: true });
  }
}
