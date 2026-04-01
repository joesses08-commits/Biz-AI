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

function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

async function detectAndProcessQuoteReply(
  userId: string,
  fromEmail: string,
  subject: string,
  body: string,
  messageId: string,
  accessToken: string
) {
  try {
    // Find any waiting jobs for this user
    const { data: jobs } = await supabaseAdmin
      .from("factory_quote_jobs")
      .select("*, factory_quotes(*)")
      .eq("user_id", userId)
      .in("status", ["waiting", "rfq_sent"]);

    if (!jobs || jobs.length === 0) return false;

    // Check if sender matches any factory in any active job
    for (const job of jobs) {
      const matchedFactory = (job.factories || []).find((f: any) =>
        f.email?.toLowerCase() === fromEmail
      );
      if (!matchedFactory) continue;

      // Already have a quote from this factory for this job?
      const alreadyReceived = (job.factory_quotes || []).find(
        (q: any) => q.factory_email?.toLowerCase() === fromEmail
      );
      if (alreadyReceived) continue;

      // Check if email has Excel attachment
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();
      const parts = msgData.payload?.parts || [];

      // Find Excel attachment
      const excelPart = parts.find((p: any) =>
        p.filename?.match(/\.xlsx?$/i) ||
        p.mimeType?.includes("spreadsheet") ||
        p.mimeType?.includes("excel")
      );

      if (excelPart && excelPart.body?.attachmentId) {
        // Download the attachment
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${excelPart.body.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const attData = await attRes.json();
        const fileBase64 = attData.data?.replace(/-/g, "+").replace(/_/g, "/") || "";

        // Auto-process the file
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/factory-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process_file",
            job_id: job.id,
            factory_name: matchedFactory.name,
            factory_email: fromEmail,
            file_base64: fileBase64,
            file_name: excelPart.filename,
            auto_detected: true,
          }),
        });

        // Log to company events
        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Gmail",
          event_type: "factory_quote_received",
          title: `Quote received from ${matchedFactory.name}`,
          summary: `Auto-detected factory quote reply for job: ${job.job_name}. Subject: ${subject}`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject },
          created_at: new Date().toISOString(),
        });

        return true;
      } else {
        // No Excel attachment — flag for manual upload
        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Gmail",
          event_type: "factory_quote_reply_no_attachment",
          title: `Quote reply from ${matchedFactory.name} — no file attached`,
          summary: `${matchedFactory.name} replied to your RFQ for "${job.job_name}" but didn't attach an Excel file. Upload it manually in Workflows.`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject, body: body.slice(0, 500) },
          created_at: new Date().toISOString(),
        });
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Quote detection error:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messageData = body.message?.data;
    if (!messageData) return NextResponse.json({ received: true });

    const decoded = decodeBase64(messageData);
    let notification: any;
    try { notification = JSON.parse(decoded); } catch { return NextResponse.json({ received: true }); }

    const gmailEmail = notification.emailAddress;
    const historyId = notification.historyId;
    if (!gmailEmail || !historyId) return NextResponse.json({ received: true });

    const { data: conn } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("email", gmailEmail)
      .single();

    if (!conn) return NextResponse.json({ received: true });
    const userId = conn.user_id;

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

    const lastHistoryId = conn.last_history_id || historyId;
    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const historyData = await historyRes.json();

    await supabaseAdmin.from("gmail_connections").update({ last_history_id: historyId }).eq("user_id", userId);

    let messages = historyData.history?.flatMap((h: any) =>
      (h.messagesAdded || []).map((m: any) => m.message)
    ) || [];

    // Fallback: if history empty, fetch recent inbox messages directly
    if (!messages.length) {
      const recentRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=in:inbox`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const recentData = await recentRes.json();
      messages = recentData.messages || [];
    }

    if (!messages.length) return NextResponse.json({ received: true });

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .single();

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
        const emailBody = extractEmailBody(data.payload).slice(0, 1000);
        const isUnread = data.labelIds?.includes("UNREAD") ? "UNREAD" : "READ";

        if (data.labelIds?.includes("SENT")) continue;

        const fromEmail = extractEmailAddress(from);

        // Check if this is a factory quote reply first
        const wasQuote = await detectAndProcessQuoteReply(
          userId, fromEmail, subject, emailBody, msg.id, accessToken
        );

        // Always process as a regular event too
        const rawData = `FROM: ${from}\nDATE: ${date}\nSUBJECT: ${subject}\nSTATUS: ${isUnread}\n${wasQuote ? "NOTE: Auto-detected as factory quote reply\n" : ""}BODY: ${emailBody}`;

        const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            source: "Gmail",
            eventType: wasQuote ? "factory_quote_email" : "email",
            rawData,
            companyContext: profile?.company_brief || "",
          }),
        });

        const eventData = await eventRes.json();

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
