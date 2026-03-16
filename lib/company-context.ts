import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshGoogleToken(connection: any) {
  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await refreshResponse.json();
  if (data.access_token) {
    await supabase.from("gmail_connections").update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", connection.user_id);
    return data.access_token;
  }
  return connection.access_token;
}

async function refreshMicrosoftToken(connection: any) {
  const refreshResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      scope: "offline_access Mail.Read Calendars.Read Files.Read",
    }),
  });
  const data = await refreshResponse.json();
  if (data.access_token) {
    await supabase.from("microsoft_connections").update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", connection.user_id);
    return data.access_token;
  }
  return connection.access_token;
}

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

async function getGmailContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshGoogleToken(conn);
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages?.length) return "";
    const emails = await Promise.all(
      listData.messages.slice(0, 50).map(async (msg: any) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        const headers = data.payload?.headers || [];
        const subject = getHeader(headers, "subject") || "(No subject)";
        const from = getHeader(headers, "from") || "Unknown";
        const date = getHeader(headers, "date") || "Unknown date";
        const body = extractEmailBody(data.payload);
        const isUnread = data.labelIds?.includes("UNREAD") ? "[UNREAD]" : "";
        return `  ${isUnread} FROM: ${from} | DATE: ${date} | SUBJECT: ${subject}\n  BODY: ${body.slice(0, 400)}`;
      })
    );
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GMAIL (${conn.email}) — ${emails.length} emails
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emails.join("\n\n")}`;
  } catch { return ""; }
}

async function getGoogleSheetsContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshGoogleToken(conn);
    const filesRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&pageSize=10&fields=files(id,name,modifiedTime)",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const filesData = await filesRes.json();
    if (!filesData.files?.length) return "";
    let sheetsContext = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOOGLE SHEETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    for (const file of filesData.files.slice(0, 5)) {
      try {
        const dataRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/A1:Z100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const sheetData = await dataRes.json();
        if (sheetData.values?.length) {
          sheetsContext += `\n\nSHEET: ${file.name} (last modified: ${file.modifiedTime || "unknown"})\n`;
          sheetData.values.slice(0, 30).forEach((row: any[]) => {
            sheetsContext += row.join(" | ") + "\n";
          });
        }
      } catch { continue; }
    }
    return sheetsContext;
  } catch { return ""; }
}

async function getOutlookContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshMicrosoftToken(conn);
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=50&$select=subject,from,receivedDateTime,body,isRead&$orderby=receivedDateTime desc",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.value?.length) return "";
    const emails = data.value.map((email: any) => {
      const body = email.body?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) || "";
      const unread = !email.isRead ? "[UNREAD]" : "";
      return `  ${unread} FROM: ${email.from?.emailAddress?.address} | DATE: ${email.receivedDateTime} | SUBJECT: ${email.subject}\n  BODY: ${body}`;
    });
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTLOOK (${conn.email}) — ${emails.length} emails
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${emails.join("\n\n")}`;
  } catch { return ""; }
}

async function getExcelContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshMicrosoftToken(conn);
    const filesRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50&$select=id,name,file,lastModifiedDateTime",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const filesData = await filesRes.json();
    const excelFiles = (filesData.value || []).filter((f: any) => f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls"));
    if (!excelFiles.length) return "";
    let context = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MICROSOFT EXCEL FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    for (const file of excelFiles.slice(0, 3)) {
      try {
        const sessionRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/createSession`,
          { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ persistChanges: false }) }
        );
        const session = await sessionRes.json();
        const sessionHeaders = { Authorization: `Bearer ${token}`, "workbook-session-id": session.id || "" };
        const sheetsRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets`, { headers: sessionHeaders });
        const sheetsData = await sheetsRes.json();
        if (!sheetsData.value?.length) continue;
        const sheetName = encodeURIComponent(sheetsData.value[0].name);
        const rangeRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets/${sheetName}/usedRange`, { headers: sessionHeaders });
        const rangeData = await rangeRes.json();
        if (rangeData.values?.length) {
          context += `\n\nFILE: ${file.name} (last modified: ${file.lastModifiedDateTime || "unknown"})\n`;
          rangeData.values.slice(0, 30).forEach((row: any[]) => { context += row.join(" | ") + "\n"; });
        }
      } catch { continue; }
    }
    return context;
  } catch { return ""; }
}

async function getStripeContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("stripe_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!}`, "Stripe-Account": conn.stripe_user_id };
    const [chargesRes, customersRes, subsRes] = await Promise.all([
      fetch("https://api.stripe.com/v1/charges?limit=100", { headers }),
      fetch("https://api.stripe.com/v1/customers?limit=100", { headers }),
      fetch("https://api.stripe.com/v1/subscriptions?limit=100&status=all", { headers }),
    ]);
    const [charges, customers, subs] = await Promise.all([chargesRes.json(), customersRes.json(), subsRes.json()]);
    const totalRevenue = (charges.data || []).filter((c: any) => c.paid).reduce((sum: number, c: any) => sum + c.amount / 100, 0);
    const mrr = (subs.data || []).filter((s: any) => s.status === "active").reduce((sum: number, s: any) => sum + (s.plan?.amount || 0) / 100, 0);
    const recentCharges = (charges.data || []).slice(0, 20).map((c: any) =>
      `  ${c.paid ? "PAID" : "FAILED"} $${(c.amount / 100).toFixed(2)} — ${c.description || "Payment"} — ${new Date(c.created * 1000).toLocaleDateString()}`
    ).join("\n");
    const customerList = (customers.data || []).slice(0, 20).map((c: any) =>
      `  ${c.email || c.id} — created ${new Date(c.created * 1000).toLocaleDateString()}`
    ).join("\n");
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRIPE — Revenue & Payments
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Revenue: $${totalRevenue.toFixed(2)}
MRR: $${mrr.toFixed(2)}
Active Subscriptions: ${(subs.data || []).filter((s: any) => s.status === "active").length}
Total Customers: ${(customers.data || []).length}

RECENT TRANSACTIONS:
${recentCharges}

CUSTOMERS:
${customerList}`;
  } catch { return ""; }
}

async function getQuickBooksContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("quickbooks_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    const headers = { Authorization: `Bearer ${conn.access_token}`, Accept: "application/json" };
    const [invoicesRes, plRes] = await Promise.all([
      fetch(`https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=SELECT * FROM Invoice MAXRESULTS 100&minorversion=65`, { headers }),
      fetch(`https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/reports/ProfitAndLoss?minorversion=65`, { headers }),
    ]);
    const [invoicesData, plData] = await Promise.all([invoicesRes.json(), plRes.json()]);
    const invoices = invoicesData.QueryResponse?.Invoice || [];
    const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + (inv.TotalAmt || 0), 0);
    const totalUnpaid = invoices.filter((inv: any) => inv.Balance > 0).reduce((sum: number, inv: any) => sum + inv.Balance, 0);
    const invoiceList = invoices.slice(0, 30).map((inv: any) =>
      `  Invoice #${inv.DocNumber} — ${inv.CustomerRef?.name} — Total: $${inv.TotalAmt} — Balance: $${inv.Balance} — Date: ${inv.TxnDate}`
    ).join("\n");
    let plContext = "";
    if (plData.Rows) plContext = `\nP&L SUMMARY:\n${JSON.stringify(plData.Rows, null, 2).slice(0, 1000)}`;
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICKBOOKS — Financials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Invoiced: $${totalInvoiced.toFixed(2)}
Total Unpaid: $${totalUnpaid.toFixed(2)}
Total Invoices: ${invoices.length}

INVOICES:
${invoiceList}
${plContext}`;
  } catch { return ""; }
}

async function getCompanyProfile(userId: string): Promise<string> {
  try {
    const { data } = await supabase.from("company_profiles").select("*").eq("user_id", userId).single();
    if (!data) return "";

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY BRAIN — Context & Standards
TODAY'S DATE: ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY NAME: ${data.company_name || "Unknown"}

WHO THIS IS / WHAT THEY DO:
${data.company_brief || "Not set"}

COMPANY BRAIN (living context — updated by CEO and AI):
${data.company_brain || "Not set"}

WHAT IS REAL vs HYPOTHETICAL:
${data.what_is_real || "Not specified — use date and context clues to determine. Data older than 6 months or named 'model', 'template', 'example', 'demo', 'test', or 'sample' should be treated as hypothetical unless context says otherwise."}

WHAT TO IGNORE / TREAT AS NOISE:
${data.what_to_ignore || "Not specified"}

WHAT MATTERS MOST TO THIS BUSINESS:
${data.what_matters || "Not specified"}

WHERE DATA LIVES:
${data.where_data_lives || "Not specified"}`;
  } catch { return ""; }
}

async function getCompanyMemory(userId: string): Promise<string> {
  try {
    const { data } = await supabase.from("company_memory").select("*").eq("user_id", userId).single();
    if (!data?.memory) return "";
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCUMULATED MEMORY
(Historical snapshots — use to detect patterns and compare to today)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${data.memory}`;
  } catch { return ""; }
}

export async function updateCompanyMemory(userId: string, newInsight: string) {
  try {
    const { data: existing } = await supabase.from("company_memory").select("memory").eq("user_id", userId).single();
    const current = existing?.memory || "";
    const today = new Date().toISOString();
    const updated = current + `\n[${today}] ${newInsight}`;
    await supabase.from("company_memory").upsert({
      user_id: userId,
      memory: updated.slice(-15000),
      last_updated: today,
    });
  } catch {}
}

export async function updateCompanyBrain(userId: string, newContext: string) {
  try {
    const { data: existing } = await supabase.from("company_profiles").select("company_brain").eq("user_id", userId).single();
    const current = existing?.company_brain || "";
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const updated = current + `\n[Updated ${today}]: ${newContext}`;
    await supabase.from("company_profiles").upsert({
      user_id: userId,
      company_brain: updated.slice(-10000),
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function buildFullCompanyContext(userId: string): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const header = `TODAY'S DATE: ${today}
DATA FRESHNESS RULES:
- Any spreadsheet/file last modified more than 90 days ago = treat as potentially outdated, flag it
- Any data with words like "model", "template", "example", "demo", "test", "sample", "hypothetical", "projected" in the name = HYPOTHETICAL, not real
- Email dates are reliable — use them to determine recency
- Always note the date of data when surfacing insights
- Never present old data as current without flagging the date`;

  const [profile, memory, gmail, sheets, outlook, excel, stripe, quickbooks] = await Promise.all([
    getCompanyProfile(userId),
    getCompanyMemory(userId),
    getGmailContext(userId),
    getGoogleSheetsContext(userId),
    getOutlookContext(userId),
    getExcelContext(userId),
    getStripeContext(userId),
    getQuickBooksContext(userId),
  ]);

  return [header, profile, memory, gmail, sheets, outlook, excel, stripe, quickbooks]
    .filter(Boolean)
    .join("\n");
}
