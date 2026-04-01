import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bustDashboardCache } from "@/lib/bust-cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshMicrosoftToken(conn: any) {
  if (new Date(conn.expires_at) > new Date()) return conn.access_token;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      scope: "Mail.Read Mail.Send Files.ReadWrite offline_access",
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

function extractEmailAddress(str: string): string {
  const match = str.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : str.toLowerCase().trim();
}

async function detectAndProcessQuoteReply(
  userId: string,
  fromEmail: string,
  subject: string,
  messageId: string,
  accessToken: string
) {
  try {
    const { data: jobs } = await supabaseAdmin
      .from("factory_quote_jobs")
      .select("*, factory_quotes(*)")
      .eq("user_id", userId)
      .in("status", ["waiting", "rfq_sent"]);

    if (!jobs?.length) return false;

    for (const job of jobs) {
      const matchedFactory = (job.factories || []).find((f: any) =>
        f.email?.toLowerCase() === fromEmail
      );
      if (!matchedFactory) continue;

      const alreadyReceived = (job.factory_quotes || []).find(
        (q: any) => q.factory_email?.toLowerCase() === fromEmail
      );
      if (alreadyReceived) continue;

      // Get full message with attachments from Graph API
      const msgRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$expand=attachments`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();

      // Find Excel attachment
      const excelAttachment = (msgData.attachments || []).find((a: any) =>
        a.name?.match(/\.xlsx?$/i) ||
        a.contentType?.includes("spreadsheet") ||
        a.contentType?.includes("excel")
      );

      if (excelAttachment?.contentBytes) {
        // Auto-process the file
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/factory-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "process_file",
            job_id: job.id,
            factory_name: matchedFactory.name,
            factory_email: fromEmail,
            file_base64: excelAttachment.contentBytes,
            file_name: excelAttachment.name,
            auto_detected: true,
          }),
        });

        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Outlook",
          event_type: "factory_quote_received",
          title: `Quote received from ${matchedFactory.name}`,
          summary: `Auto-detected factory quote reply via Outlook for job: ${job.job_name}. Subject: ${subject}`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject },
          created_at: new Date().toISOString(),
        });

        return true;
      } else {
        // Reply but no Excel — flag it
        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Outlook",
          event_type: "factory_quote_reply_no_attachment",
          title: `Quote reply from ${matchedFactory.name} — no file attached`,
          summary: `${matchedFactory.name} replied to your RFQ for "${job.job_name}" via Outlook but didn't attach an Excel file. Upload it manually in Workflows.`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject },
          created_at: new Date().toISOString(),
        });
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Outlook quote detection error:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Microsoft sends a validation token on subscription creation — must echo it back
    const url = new URL(request.url);
    const validationToken = url.searchParams.get("validationToken");
    if (validationToken) {
      return new NextResponse(validationToken, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const body = await request.json();
    const notifications = body.value || [];

    for (const notification of notifications) {
      try {
        const userId = notification.clientState;
        if (!userId) continue;

        const { data: conn } = await supabaseAdmin
          .from("microsoft_connections")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!conn) continue;

        const accessToken = await refreshMicrosoftToken(conn);

        // Get the new message
        const messageId = notification.resourceData?.id;
        if (!messageId) continue;

        const msgRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msg = await msgRes.json();

        // Skip sent items
        if (msg.isDraft || msg.sentDateTime) continue;

        const from = msg.from?.emailAddress?.address || "";
        const subject = msg.subject || "";
        const body = msg.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000) || "";
        const fromEmail = from.toLowerCase();

        // Check if factory quote reply
        const wasQuote = await detectAndProcessQuoteReply(userId, fromEmail, subject, messageId, accessToken);

        // Process as regular event
        const rawData = `FROM: ${from}\nSUBJECT: ${subject}\n${wasQuote ? "NOTE: Auto-detected as factory quote reply\n" : ""}BODY: ${body}`;

        const { data: profile } = await supabaseAdmin
          .from("company_profiles")
          .select("company_brief")
          .eq("user_id", userId)
          .single();

        const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            source: "Outlook",
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
    console.error("Microsoft push error:", err);
    return NextResponse.json({ received: true });
  }
}
