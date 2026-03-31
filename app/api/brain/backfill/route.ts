import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isImportantEmail(subject: string, snippet: string, fromAddress: string, isSent: boolean): boolean {
  const text = `${subject} ${snippet}`.toLowerCase();
  const from = fromAddress.toLowerCase();
  if (from.includes("noreply") || from.includes("no-reply") || from.includes("newsletter") || from.includes("mailer")) return false;
  if (text.includes("unsubscribe") || text.includes("newsletter") || text.includes("promotional")) return false;
  if (isSent) return true;
  const businessKeywords = ["invoice", "payment", "contract", "proposal", "deal", "order", "shipment", "urgent", "follow up", "meeting", "schedule", "offer", "quote", "agreement", "deadline", "overdue", "balance", "deposit", "$", "price", "cost", "budget", "revenue", "client", "customer", "partner"];
  if (businessKeywords.some(k => text.includes(k))) return true;
  if (subject.toLowerCase().startsWith("re:") || subject.toLowerCase().startsWith("fwd:")) return true;
  return false;
}

async function buildBrainSection(userId: string, source: string, dataText: string, companyContext: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: `You are a Chief Operating Officer building an intelligent knowledge base about a business from their historical data.

Read all the data carefully and write a comprehensive, specific summary that captures:
- Key clients, partners, vendors — who they are and the relationship status
- Financial patterns — revenue trends, outstanding amounts, payment behavior
- Ongoing deals, projects, or negotiations — status and next steps
- Recurring themes, problems, or opportunities
- Important people and their roles in the business
- Any urgent or unresolved items

Be SPECIFIC — use real names, real amounts, real dates. This summary will be the AI COO's permanent knowledge base.
Write in flowing paragraphs, not bullet points.

IMPORTANT: If the data contains spreadsheet tabs with dates and numbers (portfolio history, revenue by date, payment logs), you MUST include the exact figures in your summary. Never generalize numerical data — always preserve specific dates and dollar amounts.`,
    messages: [{
      role: "user",
      content: `COMPANY: ${companyContext}
SOURCE: ${source}

DATA:
${dataText.slice(0, 40000)}

Write the knowledge summary now.`
    }],
  });

  trackUsage(userId, "snapshot", "claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function POST(request: NextRequest) {
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

    const { source } = await request.json();

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyContext = `${profile?.company_name || ""}: ${profile?.company_brief || ""}`;
    let brainSection = "";
    let itemsProcessed = 0;

    if (source === "gmail") {
      const { data: conn } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

      let token = conn.access_token;
      if (new Date(conn.token_expiry) < new Date()) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ refresh_token: conn.refresh_token, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
        });
        const data = await res.json();
        if (data.access_token) token = data.access_token;
      }

      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const afterQuery = `after:${Math.floor(oneYearAgo.getTime() / 1000)}`;
      const allEmails: any[] = [];

      for (const folder of ["in:inbox", "in:sent"]) {
        const isSent = folder === "in:sent";
        let pageToken = "";
        let fetched = 0;

        while (fetched < 500) {
          const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(`${folder} ${afterQuery}`)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          const messages = data.messages || [];
          if (!messages.length) break;

          for (const msg of messages) {
            try {
              const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=subject&metadataHeaders=from&metadataHeaders=date`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const msgData = await msgRes.json();
              const headers = msgData.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === "Subject")?.value || "(No subject)";
              const from = headers.find((h: any) => h.name === "From")?.value || "";
              const date = headers.find((h: any) => h.name === "Date")?.value || "";
              const snippet = msgData.snippet || "";
              const isUnread = msgData.labelIds?.includes("UNREAD") || false;

              await supabaseAdmin.from("raw_emails").upsert({
                user_id: user.id, source: "Gmail", email_id: msg.id,
                from_address: from, subject, date, snippet,
                is_sent: isSent, thread_id: msgData.threadId, is_unread: isUnread,
              }, { onConflict: "email_id" }); // ignore duplicate

              allEmails.push({ subject, from, date, snippet, isSent, isUnread });
              fetched++;
              await new Promise(r => setTimeout(r, 50));
            } catch { continue; }
          }
          pageToken = data.nextPageToken || "";
          if (!pageToken) break;
        }
      }

      const importantEmails = allEmails.filter(e => isImportantEmail(e.subject, e.snippet, e.from, e.isSent));
      const emailTexts = importantEmails.slice(0, 150).map(e =>
        `${e.isSent ? "SENT" : "RECEIVED"} | ${e.date} | FROM: ${e.from} | SUBJECT: ${e.subject} | ${e.snippet.slice(0, 200)}`
      );
      itemsProcessed = emailTexts.length;
      if (emailTexts.length) brainSection = await buildBrainSection(user.id, "Gmail", emailTexts.join("\n"), companyContext);

    } else if (source === "google_drive") {
      const { data: conn } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "Google not connected" }, { status: 400 });
      const token = conn.access_token;

      const MIME_TYPES: Record<string, string> = {
        "application/vnd.google-apps.spreadsheet": "Google Sheet",
        "application/vnd.google-apps.document": "Google Doc",
        "application/vnd.google-apps.presentation": "Google Slides",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
      };

      const mimeQuery = Object.keys(MIME_TYPES).map(m => `mimeType='${m}'`).join(" or ");
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=(${mimeQuery})&pageSize=100&fields=files(id,name,mimeType,modifiedTime,lastModifyingUser)&orderBy=modifiedTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const filesData = await filesRes.json();
      const files = filesData.files || [];
      const fileTexts: string[] = [];

      for (const file of files.slice(0, 15)) {
        try {
          let content = "";
          if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            try {
              const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${token}` } });
              const meta = await metaRes.json();
              const sheets = meta.sheets || [];
              const allTabContent: string[] = [];
              for (const sheet of sheets.slice(0, 5)) {
                const title = sheet.properties?.title || "Sheet";
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(title)}!A1:Z100`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.values?.length) allTabContent.push(`TAB: ${title}\n${data.values.slice(0, 40).map((row: any[]) => row.join(" | ")).join("\n")}`);
              }
              content = allTabContent.join("\n\n");
            } catch {}
          } else if (file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            try {
              // Export Excel as CSV via Drive API
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (res.ok) {
                const csv = await res.text();
                const rows = csv.split("\n").slice(0, 40).map(r => r.trim()).filter(Boolean);
                content = `TAB: Sheet1\n${rows.join("\n")}`;
              }
            } catch {}
          } else if (file.mimeType === "application/vnd.google-apps.document") {
            const res = await fetch(`https://docs.googleapis.com/v1/documents/${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.body?.content) content = data.body.content.map((block: any) => block.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "").join("").slice(0, 2000);
          }

          await supabaseAdmin.from("raw_files").upsert({
            user_id: user.id, source: "Google Drive", file_id: file.id,
            name: file.name, file_type: MIME_TYPES[file.mimeType] || "File",
            modified_at: file.modifiedTime, content_preview: content.slice(0, 3000),
          }, { onConflict: "file_id" }); // ignore duplicate

          fileTexts.push(`FILE: ${file.name} | TYPE: ${MIME_TYPES[file.mimeType]} | MODIFIED: ${file.modifiedTime}\n${content ? `CONTENT:\n${content.slice(0, 5000)}` : ""}`);
          await new Promise(r => setTimeout(r, 200));
        } catch { continue; }
      }

      itemsProcessed = fileTexts.length;
      if (fileTexts.length) {
        brainSection = await buildBrainSection(user.id, "Google Drive", fileTexts.join("\n\n"), companyContext);
        // Append raw spreadsheet tab data to preserve exact numbers
        const rawSheets = fileTexts
          .filter(t => t.includes("TAB:"))
          .map(t => t.slice(0, 3000))
          .join("\n\n---\n\n");
        if (rawSheets) brainSection += "\n\n=== RAW SPREADSHEET DATA ===\n" + rawSheets;
      }

    } else if (source === "microsoft") {
      const { data: conn } = await supabaseAdmin.from("microsoft_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });
      const token = conn.access_token;
      const allEmails: any[] = [];

      for (const folder of ["inbox", "sentitems"]) {
        const isSent = folder === "sentitems";
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=200&$select=subject,from,receivedDateTime,bodyPreview,isRead&$orderby=receivedDateTime desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        for (const email of (data.value || [])) {
          const from = email.from?.emailAddress?.address || "";
          await supabaseAdmin.from("raw_emails").upsert({
            user_id: user.id, source: "Microsoft Outlook", email_id: email.id,
            from_address: from, subject: email.subject || "", date: email.receivedDateTime || "",
            snippet: email.bodyPreview || "", is_sent: isSent, is_unread: !email.isRead,
          }, { onConflict: "email_id" }); // ignore duplicate
          allEmails.push({ subject: email.subject, from, date: email.receivedDateTime, snippet: email.bodyPreview || "", isSent, isUnread: !email.isRead });
        }
      }

      const importantEmails = allEmails.filter(e => isImportantEmail(e.subject, e.snippet, e.from, e.isSent));
      const emailTexts = importantEmails.slice(0, 150).map(e =>
        `${e.isSent ? "SENT" : "RECEIVED"} | ${e.date} | FROM: ${e.from} | SUBJECT: ${e.subject} | ${e.snippet.slice(0, 200)}`
      );

      const filesRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100&$select=name,lastModifiedDateTime,size,file,id&$orderby=lastModifiedDateTime desc",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const filesData = await filesRes.json();
      const fileTexts = (filesData.value || []).filter((f: any) => f.file).map((f: any) =>
        `FILE: ${f.name} | MODIFIED: ${f.lastModifiedDateTime} | SIZE: ${Math.round((f.size || 0) / 1024)}KB`
      );

      const allText = [...emailTexts, ...fileTexts].join("\n");
      itemsProcessed = emailTexts.length + fileTexts.length;
      if (allText) brainSection = await buildBrainSection(user.id, "Microsoft 365", allText, companyContext);

    } else if (source === "quickbooks") {
      const { data: conn } = await supabaseAdmin.from("quickbooks_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
      const headers = { Authorization: `Bearer ${conn.access_token}`, Accept: "application/json" };

      const [invoicesRes, customersRes] = await Promise.all([
        fetch(`https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 100&minorversion=65`, { headers }),
        fetch(`https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=SELECT * FROM Customer MAXRESULTS 100&minorversion=65`, { headers }),
      ]);

      const invoices = (await invoicesRes.json()).QueryResponse?.Invoice || [];
      const customers = (await customersRes.json()).QueryResponse?.Customer || [];

      const allText = [
        ...invoices.map((inv: any) => `Invoice #${inv.DocNumber} | Customer: ${inv.CustomerRef?.name} | Total: $${inv.TotalAmt} | Balance: $${inv.Balance} | Date: ${inv.TxnDate} | Status: ${inv.Balance > 0 ? "UNPAID" : "PAID"}`),
        ...customers.map((c: any) => `Customer: ${c.DisplayName} | Balance: $${c.Balance || 0} | Active: ${c.Active}`),
      ].join("\n");

      itemsProcessed = invoices.length + customers.length;
      if (allText) brainSection = await buildBrainSection(user.id, "QuickBooks", allText, companyContext);

    } else if (source === "stripe") {
      const { data: conn } = await supabaseAdmin.from("stripe_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "Stripe not connected" }, { status: 400 });

      const [chargesRes, customersRes] = await Promise.all([
        fetch("https://api.stripe.com/v1/charges?limit=100", { headers: { Authorization: `Bearer ${conn.access_token}` } }),
        fetch("https://api.stripe.com/v1/customers?limit=100", { headers: { Authorization: `Bearer ${conn.access_token}` } }),
      ]);

      const charges = (await chargesRes.json()).data || [];
      const customers = (await customersRes.json()).data || [];

      const allText = [
        ...charges.map((c: any) => `${new Date(c.created * 1000).toISOString()} | $${(c.amount / 100).toFixed(2)} | ${c.status} | ${c.description || c.billing_details?.name || "Unknown"}`),
        ...customers.map((c: any) => `Customer: ${c.name || c.email} | Email: ${c.email}`),
      ].join("\n");

      itemsProcessed = charges.length;
      if (allText) brainSection = await buildBrainSection(user.id, "Stripe", allText, companyContext);
    }

    if (brainSection) {
      const existingBrain = profile?.company_brain || "";
      const sourceHeader = `\n\n=== ${source.toUpperCase().replace("_", " ")} HISTORY ===\n`;

      const newBrain = existingBrain + sourceHeader + brainSection;

      await supabaseAdmin.from("company_profiles").update({
        company_brain: newBrain,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
      });
    }

    return NextResponse.json({ success: true, source, itemsProcessed, hasBrainSection: !!brainSection });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
