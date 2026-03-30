import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.form": "Google Form",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel File",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
};

async function refreshGoogleToken(conn: any) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    await supabaseAdmin.from("gmail_connections").update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", conn.user_id);
    return data.access_token;
  }
  return conn.access_token;
}

async function getSheetContent(fileId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.values?.length) return "";
    return data.values.slice(0, 50).map((row: any[]) => row.join(" | ")).join("\n");
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
    const text = data.body.content
      .map((block: any) => block.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "")
      .join("")
      .slice(0, 2000);
    return text;
  } catch { return ""; }
}

async function getSlidesContent(fileId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://slides.googleapis.com/v1/presentations/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.slides?.length) return "";
    const slideTexts = data.slides.slice(0, 20).map((slide: any, i: number) => {
      const texts = slide.pageElements
        ?.filter((el: any) => el.shape?.text)
        .map((el: any) =>
          el.shape.text.textElements
            ?.map((te: any) => te.textRun?.content || "")
            .join("")
        )
        .filter(Boolean)
        .join(" | ") || "";
      return `Slide ${i + 1}: ${texts}`;
    });
    return slideTexts.join("\n");
  } catch { return ""; }
}

async function syncUserGoogleDrive(userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return { synced: 0 };

  let token = conn.access_token;
  if (new Date(conn.token_expiry) < new Date()) {
    token = await refreshGoogleToken(conn);
  }

  // First time = full 1 year scan. After that = incremental from last event.
  let afterDate: string;
  if (!conn.initial_sync_done) {
    afterDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    const { data: lastEvent } = await supabaseAdmin
      .from("company_events")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "Google Drive")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    afterDate = lastEvent
      ? new Date(lastEvent.created_at).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const mimeQuery = Object.keys(MIME_TYPES).map(m => `mimeType='${m}'`).join(" or ");
  const pageSize = !conn.initial_sync_done ? 50 : 20;
  const filesRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=(${mimeQuery}) and modifiedTime > '${afterDate}'&pageSize=${pageSize}&fields=files(id,name,mimeType,modifiedTime,owners,lastModifyingUser,size)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const filesData = await filesRes.json();
  const files = filesData.files || [];

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_brief")
    .eq("user_id", userId)
    .maybeSingle();

  let synced = 0;
  let hasImportant = false;

  for (const file of files) {
    try {
      const fileType = MIME_TYPES[file.mimeType] || "File";
      const modifier = file.lastModifyingUser?.displayName || "Unknown";

      let content = "";
      if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
        content = await getSheetContent(file.id, token);
      } else if (file.mimeType === "application/vnd.google-apps.document") {
        content = await getDocContent(file.id, token);
      } else if (file.mimeType === "application/vnd.google-apps.presentation") {
        content = await getSlidesContent(file.id, token);
      }

      const rawData = `File: ${file.name}
Type: ${fileType}
Last Modified: ${file.modifiedTime}
Modified By: ${modifier}
${content ? `\nContent Preview:\n${content.slice(0, 1500)}` : ""}`;

      const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          source: "Google Drive",
          eventType: `${fileType.toLowerCase().replace(" ", "_")}_modified`,
          rawData,
          companyContext: profile?.company_brief || "",
        }),
      });

      const eventData = await eventRes.json();
      if (eventData.analysis?.importance === "critical" || eventData.analysis?.importance === "high") {
        hasImportant = true;
      }

      synced++;
      await new Promise(r => setTimeout(r, 500));
    } catch { continue; }
  }

  // Mark initial sync done after first run
  if (!conn.initial_sync_done) {
    await supabaseAdmin
      .from("gmail_connections")
      .update({ initial_sync_done: true })
      .eq("user_id", userId);
  }

  if (hasImportant) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    }).catch(() => {});
  }

  return { synced };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabaseAdmin
    .from("gmail_connections")
    .select("user_id");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;
  for (const conn of connections) {
    try {
      const result = await syncUserGoogleDrive(conn.user_id);
      totalSynced += result.synced;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, totalSynced });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const result = await syncUserGoogleDrive(userId);
  return NextResponse.json({ success: true, ...result });
}
