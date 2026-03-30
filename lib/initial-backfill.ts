import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

async function saveHistoricalSummary(userId: string, source: string, summary: string) {
  await supabaseAdmin.from("company_events").insert({
    user_id: userId,
    source,
    event_type: "historical_backfill",
    raw_data: summary.slice(0, 5000),
    analysis: summary.slice(0, 500),
    tone: "neutral",
    importance: "high",
    action_required: false,
  });
}

async function buildHistoricalSummary(userId: string, source: string, rawDataText: string, companyContext: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: `You are a business analyst doing a one-time historical analysis of a business's data. 
Summarize the key patterns, relationships, outstanding items, and important context you find.
Be specific — name clients, amounts, dates, patterns. This summary will be used to give an AI COO context about the business history.
Write 3-5 paragraphs covering: key relationships, financial patterns, recurring themes, outstanding items, and anything unusual.`,
    messages: [{
      role: "user",
      content: `COMPANY: ${companyContext}
SOURCE: ${source}

HISTORICAL DATA:
${rawDataText.slice(0, 8000)}

Write the historical summary now.`
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// GMAIL — batch scan last 200 emails, one Sonnet summary
export async function gmailInitialBackfill(userId: string, accessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";

    // Fetch last 200 email metadata only (fast, no full bodies)
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=in:inbox",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];
    if (!messages.length) return;

    // Fetch details for first 100 — subject, from, date, snippet only
    const emailSummaries: string[] = [];
    for (const msg of messages.slice(0, 100)) {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=subject&metadataHeaders=from&metadataHeaders=date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        const headers = data.payload?.headers || [];
        const subject = getHeader(headers, "subject") || "(No subject)";
        const from = getHeader(headers, "from") || "Unknown";
        const date = getHeader(headers, "date") || "";
        const snippet = data.snippet || "";
        emailSummaries.push(`${date} | FROM: ${from} | SUBJECT: ${subject} | ${snippet.slice(0, 100)}`);
        await new Promise(r => setTimeout(r, 100));
      } catch { continue; }
    }

    if (!emailSummaries.length) return;

    const rawDataText = emailSummaries.join("\n");
    const summary = await buildHistoricalSummary(userId, "Gmail", rawDataText, companyContext);
    await saveHistoricalSummary(userId, "Gmail", summary);

    // Mark initial sync done
    await supabaseAdmin.from("gmail_connections")
      .update({ initial_sync_done: true })
      .eq("user_id", userId);

    // Trigger snapshot
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("Gmail backfill error:", err);
  }
}

// MICROSOFT — batch scan Outlook + OneDrive, one Sonnet summary each
export async function microsoftInitialBackfill(userId: string, accessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";

    // Fetch last 100 Outlook emails — metadata only
    const emailsRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=100&$select=subject,from,receivedDateTime,bodyPreview&$orderby=receivedDateTime desc",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const emailsData = await emailsRes.json();
    const emails = emailsData.value || [];

    if (emails.length) {
      const emailText = emails.map((e: any) =>
        `${e.receivedDateTime} | FROM: ${e.from?.emailAddress?.address} | SUBJECT: ${e.subject} | ${(e.bodyPreview || "").slice(0, 100)}`
      ).join("\n");

      const emailSummary = await buildHistoricalSummary(userId, "Microsoft Outlook", emailText, companyContext);
      await saveHistoricalSummary(userId, "Microsoft Outlook", emailSummary);
    }

    // Fetch OneDrive files
    const filesRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100&$select=name,lastModifiedDateTime,size,file&$orderby=lastModifiedDateTime desc",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const filesData = await filesRes.json();
    const files = (filesData.value || []).filter((f: any) => f.file);

    if (files.length) {
      const filesText = files.map((f: any) =>
        `${f.lastModifiedDateTime} | FILE: ${f.name} | SIZE: ${Math.round((f.size || 0) / 1024)}KB`
      ).join("\n");

      const filesSummary = await buildHistoricalSummary(userId, "Microsoft OneDrive", filesText, companyContext);
      await saveHistoricalSummary(userId, "Microsoft OneDrive", filesSummary);
    }

    // Mark initial sync done
    await supabaseAdmin.from("microsoft_connections")
      .update({ initial_sync_done: true })
      .eq("user_id", userId);

    // Trigger snapshot
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("Microsoft backfill error:", err);
  }
}

// STRIPE — all transactions, one Sonnet summary
export async function stripeInitialBackfill(userId: string, stripeAccessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";

    const res = await fetch(
      "https://api.stripe.com/v1/charges?limit=100",
      { headers: { Authorization: `Bearer ${stripeAccessToken}` } }
    );
    const data = await res.json();
    const charges = data.data || [];

    if (!charges.length) return;

    const chargesText = charges.map((c: any) =>
      `${new Date(c.created * 1000).toISOString()} | $${(c.amount / 100).toFixed(2)} ${c.currency.toUpperCase()} | ${c.status} | ${c.description || c.billing_details?.name || "Unknown"}`
    ).join("\n");

    const summary = await buildHistoricalSummary(userId, "Stripe", chargesText, companyContext);
    await saveHistoricalSummary(userId, "Stripe", summary);

    // Trigger snapshot
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("Stripe backfill error:", err);
  }
}

// QUICKBOOKS — all invoices + customers, one Sonnet summary
export async function quickbooksInitialBackfill(userId: string, accessToken: string, realmId: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    // Fetch all invoices
    const invoicesRes = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 100&minorversion=65`,
      { headers }
    );
    const invoicesData = await invoicesRes.json();
    const invoices = invoicesData.QueryResponse?.Invoice || [];

    if (!invoices.length) return;

    const invoicesText = invoices.map((inv: any) =>
      `Invoice #${inv.DocNumber} | Customer: ${inv.CustomerRef?.name} | Total: $${inv.TotalAmt} | Balance: $${inv.Balance} | Date: ${inv.TxnDate} | Status: ${inv.Balance > 0 ? "UNPAID" : "PAID"}`
    ).join("\n");

    const summary = await buildHistoricalSummary(userId, "QuickBooks", invoicesText, companyContext);
    await saveHistoricalSummary(userId, "QuickBooks", summary);

    // Mark initial sync done
    await supabaseAdmin.from("quickbooks_connections")
      .update({ initial_sync_done: true })
      .eq("user_id", userId);

    // Trigger snapshot
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("QuickBooks backfill error:", err);
  }
}
