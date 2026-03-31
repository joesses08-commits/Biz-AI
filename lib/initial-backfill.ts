import Anthropic from "@anthropic-ai/sdk";
import { trackUsage } from "@/lib/track-usage";
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

async function getSheetContent(fileId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.values?.length) return "";
    return data.values.slice(0, 30).map((row: any[]) => row.join(" | ")).join("\n");
  } catch { return ""; }
}

async function getDocContent(fileId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://docs.googleapis.com/v1/documents/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.body?.content) return "";
    return data.body.content
      .map((block: any) => block.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "")
      .join("")
      .slice(0, 1000);
  } catch { return ""; }
}

// GMAIL + GOOGLE DRIVE — batch scan, one Sonnet call each
export async function gmailInitialBackfill(userId: string, accessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";

    // ── GMAIL ──────────────────────────────────────────────
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=in:inbox",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length) {
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
          await new Promise(r => setTimeout(r, 80));
        } catch { continue; }
      }

      if (emailSummaries.length) {
        const summary = await buildHistoricalSummary(userId, "Gmail", emailSummaries.join("\n"), companyContext);
        await saveHistoricalSummary(userId, "Gmail", summary);
      }
    }

    // ── GOOGLE DRIVE ───────────────────────────────────────
    const MIME_TYPES: Record<string, string> = {
      "application/vnd.google-apps.spreadsheet": "Google Sheet",
      "application/vnd.google-apps.document": "Google Doc",
      "application/vnd.google-apps.presentation": "Google Slides",
      "application/pdf": "PDF",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
    };

    const mimeQuery = Object.keys(MIME_TYPES).map(m => `mimeType='${m}'`).join(" or ");
    const filesRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=(${mimeQuery})&pageSize=50&fields=files(id,name,mimeType,modifiedTime,lastModifyingUser)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const filesData = await filesRes.json();
    const files = filesData.files || [];

    if (files.length) {
      const fileDetails: string[] = [];

      for (const file of files.slice(0, 30)) {
        try {
          const fileType = MIME_TYPES[file.mimeType] || "File";
          let content = "";

          if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            content = await getSheetContent(file.id, accessToken);
          } else if (file.mimeType === "application/vnd.google-apps.document") {
            content = await getDocContent(file.id, accessToken);
          }

          fileDetails.push(`FILE: ${file.name} | TYPE: ${fileType} | MODIFIED: ${file.modifiedTime} | BY: ${file.lastModifyingUser?.displayName || "Unknown"}${content ? `\nCONTENT PREVIEW:\n${content.slice(0, 500)}` : ""}`);
          await new Promise(r => setTimeout(r, 200));
        } catch { continue; }
      }

      if (fileDetails.length) {
        const summary = await buildHistoricalSummary(userId, "Google Drive", fileDetails.join("\n\n"), companyContext);
        await saveHistoricalSummary(userId, "Google Drive", summary);
      }
    }

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
    console.error("Gmail/Drive backfill error:", err);
  }
}

// MICROSOFT — Outlook + OneDrive batch scan
export async function microsoftInitialBackfill(userId: string, accessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";

    // ── OUTLOOK ────────────────────────────────────────────
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

    // ── ONEDRIVE ───────────────────────────────────────────
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

// STRIPE — all charges, one Sonnet summary
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

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("Stripe backfill error:", err);
  }
}

// QUICKBOOKS — all invoices, one Sonnet summary
export async function quickbooksInitialBackfill(userId: string, accessToken: string, realmId: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", userId)
      .maybeSingle();

    const companyContext = profile?.company_brief || "";
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

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

    await supabaseAdmin.from("quickbooks_connections")
      .update({ initial_sync_done: true })
      .eq("user_id", userId);

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("QuickBooks backfill error:", err);
  }
}
