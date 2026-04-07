import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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


async function detectAndProcessQuoteReplyOutlook(
  userId: string,
  fromEmail: string,
  subject: string,
  body: string,
  messageId: string,
  accessToken: string
) {
  try {
    const { data: jobs } = await supabaseAdmin
      .from("factory_quote_jobs")
      .select("*, factory_quotes(*)")
      .eq("user_id", userId)
      .in("status", ["waiting", "rfq_sent"]);

    if (!jobs || jobs.length === 0) return false;

    for (const job of jobs) {
      const matchedFactory = (job.factories || []).find((f: any) =>
        f.email?.toLowerCase() === fromEmail.toLowerCase()
      );
      if (!matchedFactory) continue;

      const alreadyReceived = (job.factory_quotes || []).find(
        (q: any) => q.factory_email?.toLowerCase() === fromEmail.toLowerCase()
      );
      if (alreadyReceived) continue;

      // Fetch attachments for this message via Graph API
      const attRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const attData = await attRes.json();
      const attachments = attData.value || [];

      const excelAtt = attachments.find((a: any) =>
        a.name?.match(/\.xlsx?$/i) ||
        a.contentType?.includes("spreadsheet") ||
        a.contentType?.includes("excel")
      );

      if (excelAtt && excelAtt.contentBytes) {
        // contentBytes is already base64 from Graph API
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/factory-quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.CRON_SECRET || "",
            "x-user-id": userId,
          },
          body: JSON.stringify({
            action: "process_file",
            job_id: job.id,
            factory_name: matchedFactory.name,
            factory_email: fromEmail,
            file_base64: excelAtt.contentBytes,
            file_name: excelAtt.name,
            auto_detected: true,
          }),
        });

        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Microsoft",
          event_type: "factory_quote_received",
          title: `Quote received from ${matchedFactory.name}`,
          summary: `Auto-detected factory quote reply via Outlook for job: ${job.job_name}. Subject: ${subject}`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject },
          created_at: new Date().toISOString(),
        });

        return true;
      } else {
        await supabaseAdmin.from("company_events").insert({
          user_id: userId,
          source: "Microsoft",
          event_type: "factory_quote_reply_no_attachment",
          title: `Quote reply from ${matchedFactory.name} — no file attached`,
          summary: `${matchedFactory.name} replied to your RFQ for "${job.job_name}" via Outlook but didn't attach an Excel file. Upload it manually in Workflows.`,
          importance: "high",
          raw_data: { job_id: job.id, factory: matchedFactory.name, subject, body: body.slice(0, 500) },
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

async function syncUserMicrosoft(userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return { synced: 0 };

  let token = conn.access_token;
  if (new Date(conn.expires_at) < new Date()) {
    token = await refreshMicrosoftToken(conn);
  }

  // First time = full 1 year scan. After that = incremental.
  let afterDate: string;
  let topCount: number;
  if (!conn.initial_sync_done) {
    afterDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    topCount = 50;
  } else {
    const { data: lastEvent } = await supabaseAdmin
      .from("company_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "Microsoft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    afterDate = lastEvent
      ? new Date(lastEvent.created_at).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    topCount = 10;
  }

  const emailsRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$top=${topCount}&$filter=receivedDateTime gt ${afterDate}&$select=subject,from,receivedDateTime,body,isRead&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const emailsData = await emailsRes.json();
  const emails = emailsData.value || [];

  if (!emails.length) {
    if (!conn.initial_sync_done) {
      await supabaseAdmin.from("microsoft_connections").update({ initial_sync_done: true }).eq("user_id", userId);
    }
    return { synced: 0 };
  }

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_brief")
    .eq("user_id", userId)
    .maybeSingle();

  let synced = 0;
  let hasImportant = false;

  for (const email of emails) {
    const fromEmail = email.from?.emailAddress?.address || "";
    const body = email.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000) || "";

    // Auto-detect factory quote replies
    const wasQuote = await detectAndProcessQuoteReplyOutlook(
      userId,
      fromEmail,
      email.subject || "",
      body,
      email.id,
      token
    );

    const rawData = `FROM: ${fromEmail}\nDATE: ${email.receivedDateTime}\nSUBJECT: ${email.subject || "(No subject)"}\nSTATUS: ${email.isRead ? "READ" : "UNREAD"}${wasQuote ? "\nNOTE: Auto-detected as factory quote reply" : ""}\nBODY: ${body}`;

    const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
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

  // Mark initial sync done after first run
  if (!conn.initial_sync_done) {
    await supabaseAdmin.from("microsoft_connections").update({ initial_sync_done: true }).eq("user_id", userId);
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
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabaseAdmin
    .from("microsoft_connections")
    .select("user_id");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;
  for (const conn of connections) {
    try {
      const result = await syncUserMicrosoft(conn.user_id);
      totalSynced += result.synced;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, totalSynced });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const result = await syncUserMicrosoft(userId);
  return NextResponse.json({ success: true, ...result });
}
