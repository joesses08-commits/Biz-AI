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
    const messages = listData.messages.slice(0, 50);
    const emails: string[] = [];
    
    // Fetch in batches of 10 to avoid timeout
    for (let i = 0; i < messages.length; i += 10) {
      const batch = messages.slice(i, i + 10);
      const batchResults = await Promise.all(
        batch.map(async (msg: any) => {
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
      emails.push(...batchResults);
    }
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

async function refreshQuickBooksToken(conn: any) {
  try {
    const credentials = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      await supabase.from("quickbooks_connections").update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || conn.refresh_token,
      }).eq("user_id", conn.user_id);
      return data.access_token;
    }
  } catch {}
  return conn.access_token;
}

async function getQuickBooksContext(userId: string): Promise<string> {
  try {
    const { data: conn } = await supabase.from("quickbooks_connections").select("*").eq("user_id", userId).single();
    if (!conn) return "";
    const token = await refreshQuickBooksToken(conn);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
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


// ─── PLM CONTEXT ─────────────────────────────────────────────────────────────
async function getPLMContext(userId: string): Promise<string> {
  try {
    const { data: products } = await supabase
      .from("plm_products")
      .select("*, plm_collections(name, season), plm_batches(id, current_stage, order_quantity, linked_po_number), plm_sample_requests(status, current_stage, factory_catalog(name))")
      .eq("user_id", userId)
      .eq("killed", false)
      .order("created_at", { ascending: false });

    if (!products || products.length === 0) return "";

    const { data: collections } = await supabase
      .from("plm_collections")
      .select("id, name, season, year")
      .eq("user_id", userId);

    const { data: rfqJobs } = await supabase
      .from("factory_quote_jobs")
      .select("id, status, created_at, product_count")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const stageSummary: Record<string, number> = {};
    const actionRequired: string[] = [];
    const inProduction: string[] = [];
    const samplePending: string[] = [];
    const recentOrders: string[] = [];

    for (const p of products) {
      const stage = p.current_stage || "concept";
      stageSummary[stage] = (stageSummary[stage] || 0) + 1;
      const batches = p.plm_batches || [];
      const samples = p.plm_sample_requests || [];
      const activeBatch = batches.find((b: any) => !["shipped", "delivered"].includes(b.current_stage));
      const approvedSample = samples.find((s: any) => s.status === "approved");
      if (p.action_status === "action_required" && batches.length === 0) {
        actionRequired.push(p.name + " (" + (p.sku || "no SKU") + ") — needs attention at stage: " + stage);
      }
      if (activeBatch) {
        inProduction.push(p.name + " — " + activeBatch.current_stage + (activeBatch.order_quantity ? ", " + activeBatch.order_quantity + " units" : "") + (approvedSample?.factory_catalog?.name ? " @ " + approvedSample.factory_catalog.name : ""));
      }
      if (samples.some((s: any) => s.status === "requested")) {
        const factoryNames = samples.filter((s: any) => s.status === "requested").map((s: any) => s.factory_catalog?.name || "unknown factory").join(", ");
        samplePending.push(p.name + " — sample at " + factoryNames + " (stage: " + (samples.find((s: any) => s.status === "requested")?.current_stage || "unknown") + ")");
      }
      for (const b of batches) {
        if (b.linked_po_number) {
          recentOrders.push("PO " + b.linked_po_number + " — " + p.name + " — " + b.current_stage + (b.order_quantity ? " (" + b.order_quantity + " units)" : ""));
        }
      }
    }

    const collectionList = (collections || []).map((c: any) => c.name + (c.season ? " (" + c.season + " " + (c.year || "") + ")" : "")).join(", ");
    const stageLines = Object.entries(stageSummary).map(([stage, count]) => "  " + stage + ": " + count + " product" + (count > 1 ? "s" : "")).join("\n");

    let context = "\n\n" + "━".repeat(32) + "\nPRODUCT LIFECYCLE (PLM)\n" + "━".repeat(32);
    context += "\nTotal Active Products: " + products.length;
    context += "\nCollections: " + (collectionList || "None");
    context += "\n\nSTAGE BREAKDOWN:\n" + stageLines;

    if (actionRequired.length > 0) {
      context += "\n\nNEEDS ATTENTION (" + actionRequired.length + "):\n" + actionRequired.map(p => "  • " + p).join("\n");
    }
    if (inProduction.length > 0) {
      context += "\n\nIN PRODUCTION (" + inProduction.length + "):\n" + inProduction.map(p => "  • " + p).join("\n");
    }
    if (samplePending.length > 0) {
      context += "\n\nSAMPLES IN PROGRESS (" + samplePending.length + "):\n" + samplePending.map(p => "  • " + p).join("\n");
    }
    if (recentOrders.length > 0) {
      context += "\n\nACTIVE PURCHASE ORDERS:\n" + recentOrders.map(o => "  • " + o).join("\n");
    }
    if (rfqJobs && rfqJobs.length > 0) {
      context += "\n\nRECENT RFQ JOBS:\n" + rfqJobs.map((j: any) => "  • " + new Date(j.created_at).toLocaleDateString() + " — " + (j.product_count || "?") + " products — " + j.status).join("\n");
    }

    return context;
  } catch { return ""; }
}

// ─── CACHE ────────────────────────────────────────────────────────────────────
const CACHE_MINUTES = 45;

async function getCachedContext(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("context_cache").select("*").eq("user_id", userId).single();
    if (!data) return null;
    const cachedAt = new Date(data.cached_at);
    const ageMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
    if (ageMinutes > CACHE_MINUTES) return null;
    return data.context;
  } catch { return null; }
}

async function saveContextCache(userId: string, context: string) {
  try {
    await supabase.from("context_cache").upsert({
      user_id: userId,
      context,
      cached_at: new Date().toISOString(),
    });
  } catch {}
}

// ─── MASTER CONTEXT BUILDER ───────────────────────────────────────────────────
export async function buildFullCompanyContext(userId: string): Promise<string> {
  const cached = await getCachedContext(userId);
  if (cached) return cached;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const header = `TODAY'S DATE: ${today}
DATA FRESHNESS RULES:
- Any spreadsheet/file last modified more than 90 days ago = treat as potentially outdated, flag it
- Any data with words like "model", "template", "example", "demo", "test", "sample", "hypothetical", "projected" in the name = HYPOTHETICAL, not real
- Email dates are reliable — use them to determine recency
- Always note the date of data when surfacing insights
- Never present old data as current without flagging the date`;

  const [profile, memory, gmail, sheets, outlook, excel, stripe, quickbooks, plm] = await Promise.all([
    getCompanyProfile(userId),
    getCompanyMemory(userId),
    getGmailContext(userId),
    getGoogleSheetsContext(userId),
    getOutlookContext(userId),
    getExcelContext(userId),
    getStripeContext(userId),
    getQuickBooksContext(userId),
    getPLMContext(userId),
  ]);

  const context = [header, profile, memory, gmail, sheets, outlook, excel, stripe, quickbooks, plm]
    .filter(Boolean)
    .join("\n");

  await saveContextCache(userId, context);

  return context;
}
