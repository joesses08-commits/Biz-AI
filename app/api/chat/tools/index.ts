import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGoogleToken(userId: string) {
  const { data } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", userId).single();
  if (!data?.access_token) return null;
  if (new Date(data.token_expiry) < new Date()) {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const rd = await r.json();
    if (rd.access_token) {
      await supabaseAdmin.from("gmail_connections").update({
        access_token: rd.access_token,
        token_expiry: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
      return rd.access_token;
    }
  }
  return data.access_token;
}

async function getMicrosoftToken(userId: string) {
  const { data } = await supabaseAdmin.from("microsoft_connections").select("*").eq("user_id", userId).single();
  if (!data?.access_token) return null;
  if (new Date(data.expires_at) < new Date()) {
    const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: "refresh_token",
        scope: "Mail.ReadWrite Mail.Send Files.ReadWrite Calendars.ReadWrite offline_access",
      }),
    });
    const rd = await r.json();
    if (rd.access_token) {
      await supabaseAdmin.from("microsoft_connections").update({
        access_token: rd.access_token,
        expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
      return rd.access_token;
    }
  }
  return data.access_token;
}

// ── FIND SHEET ─────────────────────────────────────────────────────────────
export async function findSheet(userId: string, name: string) {
  const token = await getGoogleToken(userId);
  if (!token) return { error: "Google not connected" };
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name+contains+'${encodeURIComponent(name)}'+and+mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return { files: data.files || [] };
}

// ── READ SHEET ─────────────────────────────────────────────────────────────
export async function readSheet(userId: string, spreadsheetId: string, range: string = "Sheet1!A1:Z100") {
  const token = await getGoogleToken(userId);
  if (!token) return { error: "Google not connected" };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return { values: data.values || [], range: data.range };
}

// ── GET FORMULA CELLS ─────────────────────────────────────────────────────
export async function getFormulaCells(userId: string, spreadsheetId: string, range: string) {
  const token = await getGoogleToken(userId);
  if (!token) return { error: "Google not connected" };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&fields=sheets.data.rowData.values(userEnteredValue,userEnteredFormat)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const formulaCells: string[] = [];
  const rows = data.sheets?.[0]?.data?.[0]?.rowData || [];
  // Parse range to get start col/row
  const match = range.match(/([A-Z]+)(\d+)/);
  if (match) {
    const startRow = parseInt(match[2]);
    rows.forEach((row: any, ri: number) => {
      (row.values || []).forEach((cell: any, ci: number) => {
        if (cell?.userEnteredValue?.formulaValue) {
          const col = String.fromCharCode(65 + ci);
          formulaCells.push(`${col}${startRow + ri}`);
        }
      });
    });
  }
  return { formulaCells };
}

// ── WRITE SHEET ────────────────────────────────────────────────────────────
export async function writeSheet(userId: string, spreadsheetId: string, range: string, values: any[][]) {
  const token = await getGoogleToken(userId);
  if (!token) return { error: "Google not connected" };

  // Check for formula cells before writing
  const formulaCheck = await getFormulaCells(userId, spreadsheetId, range);
  if (formulaCheck.formulaCells?.length) {
    return {
      error: `Cannot write to formula cells: ${formulaCheck.formulaCells.join(", ")}. These cells contain formulas that would be overwritten. Please only write to input cells.`,
      formulaCells: formulaCheck.formulaCells,
    };
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  if (data.error) {
    console.error("writeSheet error:", JSON.stringify(data.error));
    return { error: data.error.message || "Write failed", status: res.status };
  }
  return { updated: data.updatedCells, range: data.updatedRange, success: true };
}

// ── APPEND ROW TO SHEET ────────────────────────────────────────────────────
export async function appendRow(userId: string, spreadsheetId: string, range: string, values: any[][]) {
  const token = await getGoogleToken(userId);
  if (!token) return { error: "Google not connected" };
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  return { updated: data.updates?.updatedCells, range: data.updates?.updatedRange };
}

// ── READ EXCEL (Microsoft) ─────────────────────────────────────────────────
export async function findExcel(userId: string, name: string) {
  const token = await getMicrosoftToken(userId);
  if (!token) return { error: "Microsoft not connected" };
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/search(q='${encodeURIComponent(name)}')?$filter=file/mimeType eq 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&$select=id,name,webUrl`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return { files: data.value || [] };
}

export async function readExcel(userId: string, fileId: string, sheet: string = "Sheet1") {
  const token = await getMicrosoftToken(userId);
  if (!token) return { error: "Microsoft not connected" };
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheet}/usedRange`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return { values: data.values || [], address: data.address };
}

export async function writeExcel(userId: string, fileId: string, sheet: string, address: string, values: any[][]) {
  const token = await getMicrosoftToken(userId);
  if (!token) return { error: "Microsoft not connected" };
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheet}/range(address='${address}')`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  const data = await res.json();
  return { address: data.address, updated: true };
}

// ── SEND EMAIL ─────────────────────────────────────────────────────────────
export async function sendEmail(userId: string, to: string, subject: string, body: string, provider: "gmail" | "outlook" | "auto" = "auto") {
  const googleToken = await getGoogleToken(userId);
  const msToken = await getMicrosoftToken(userId);

  const useGmail = provider === "gmail" || (provider === "auto" && !!googleToken);
  const useOutlook = provider === "outlook" || (provider === "auto" && !googleToken && !!msToken);

  if (useGmail && googleToken) {
    const mime = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, ``, body].join("\r\n");
    const encoded = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encoded }),
    });
    const data = await res.json();
    return { sent: !!data.id, provider: "gmail", messageId: data.id };
  }

  if (useOutlook && msToken) {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });
    return { sent: res.status === 202, provider: "outlook" };
  }

  return { error: "No email provider connected" };
}

// ── READ EMAILS ────────────────────────────────────────────────────────────
export async function searchEmails(userId: string, query: string, maxResults: number = 10) {
  const token = await getGoogleToken(userId);
  if (!token) {
    // Try Outlook
    const msToken = await getMicrosoftToken(userId);
    if (!msToken) return { error: "No email connected" };
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"&$top=${maxResults}&$select=subject,from,receivedDateTime,bodyPreview`,
      { headers: { Authorization: `Bearer ${msToken}` } }
    );
    const data = await res.json();
    return { emails: (data.value || []).map((e: any) => ({ subject: e.subject, from: e.from?.emailAddress?.address, date: e.receivedDateTime, preview: e.bodyPreview })) };
  }
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const messages = await Promise.all((data.messages || []).slice(0, 5).map(async (m: any) => {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject,From,Date`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const headers = d.payload?.headers || [];
    return {
      id: m.id,
      subject: headers.find((h: any) => h.name === "Subject")?.value,
      from: headers.find((h: any) => h.name === "From")?.value,
      date: headers.find((h: any) => h.name === "Date")?.value,
      snippet: d.snippet,
    };
  }));
  return { emails: messages };
}

// ── CREATE ACTION ITEM ─────────────────────────────────────────────────────
export async function createActionItem(userId: string, title: string, description: string, dueDate?: string, priority: string = "medium") {
  const { data } = await supabaseAdmin.from("action_items").insert({
    user_id: userId,
    title,
    description,
    due_date: dueDate || null,
    priority,
    status: "pending",
    created_at: new Date().toISOString(),
  }).select().single();
  return { created: true, id: data?.id, title };
}

// ── ADD CALENDAR EVENT ─────────────────────────────────────────────────────
export async function addCalendarEvent(userId: string, title: string, start: string, end: string, description: string = "", provider: "google" | "outlook" | "auto" = "auto") {
  const googleToken = await getGoogleToken(userId);
  const msToken = await getMicrosoftToken(userId);
  const useGoogle = provider === "google" || (provider === "auto" && !!googleToken);

  if (useGoogle && googleToken) {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: title,
        description,
        start: { dateTime: start, timeZone: "America/New_York" },
        end: { dateTime: end, timeZone: "America/New_York" },
      }),
    });
    const data = await res.json();
    return { created: true, provider: "google", eventId: data.id, link: data.htmlLink };
  }

  if (msToken) {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: title,
        body: { contentType: "Text", content: description },
        start: { dateTime: start, timeZone: "Eastern Standard Time" },
        end: { dateTime: end, timeZone: "Eastern Standard Time" },
      }),
    });
    const data = await res.json();
    return { created: true, provider: "outlook", eventId: data.id };
  }

  return { error: "No calendar connected" };
}

// ── FIND TRANSCRIPT ────────────────────────────────────────────────────────
export async function findTranscript(userId: string, query: string = "") {
  const results: any[] = [];

  // Google Drive — Meet transcripts
  const googleToken = await getGoogleToken(userId);
  if (googleToken) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name+contains+'transcript'${query ? `+and+fullText+contains+'${encodeURIComponent(query)}'` : ""}&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime+desc&pageSize=5`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    const data = await res.json();
    for (const file of (data.files || [])) {
      results.push({ source: "Google Drive", id: file.id, name: file.name, date: file.modifiedTime });
    }
  }

  // OneDrive — Teams .vtt transcripts
  const msToken = await getMicrosoftToken(userId);
  if (msToken) {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/search(q='transcript')?$select=id,name,createdDateTime,webUrl&$top=5`,
      { headers: { Authorization: `Bearer ${msToken}` } }
    );
    const data = await res.json();
    for (const file of (data.value || [])) {
      if (file.name?.match(/\.(vtt|txt|docx)$/i)) {
        results.push({ source: "OneDrive", id: file.id, name: file.name, date: file.createdDateTime, url: file.webUrl });
      }
    }
  }

  return { transcripts: results };
}

export async function readTranscriptContent(userId: string, fileId: string, source: "google" | "microsoft") {
  if (source === "google") {
    const token = await getGoogleToken(userId);
    if (!token) return { error: "Google not connected" };
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await res.text();
    return { content: text.slice(0, 8000) };
  } else {
    const token = await getMicrosoftToken(userId);
    if (!token) return { error: "Microsoft not connected" };
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await res.text();
    return { content: text.slice(0, 8000) };
  }
}

// ── CREATE FACTORY QUOTE JOB ───────────────────────────────────────────────
export async function createFactoryQuoteJob(userId: string, jobName: string, factories: { name: string; email: string }[], orderDetails: any) {
  const { data } = await supabaseAdmin.from("factory_quote_jobs").insert({
    user_id: userId,
    job_name: jobName,
    factories,
    order_details: orderDetails,
    status: "waiting",
    created_at: new Date().toISOString(),
  }).select().single();
  return { created: true, jobId: data?.id, jobName };
}

// ── GET QUICKBOOKS DATA ────────────────────────────────────────────────────
export async function getQuickBooksInvoices(userId: string, status: string = "all") {
  const { data: conn } = await supabaseAdmin.from("quickbooks_connections").select("*").eq("user_id", userId).single();
  if (!conn) return { error: "QuickBooks not connected" };
  // Return from company events (QB data already synced to brain)
  const { data: events } = await supabaseAdmin
    .from("company_events")
    .select("raw_data, analysis, created_at")
    .eq("user_id", userId)
    .eq("source", "QuickBooks")
    .order("created_at", { ascending: false })
    .limit(50);
  return { invoices: events || [], source: "company_events" };
}
