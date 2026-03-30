import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FILE_TYPES: Record<string, string> = {
  ".xlsx": "Excel Spreadsheet",
  ".xls": "Excel Spreadsheet",
  ".docx": "Word Document",
  ".doc": "Word Document",
  ".pptx": "PowerPoint Presentation",
  ".ppt": "PowerPoint Presentation",
  ".pdf": "PDF Document",
};

function getFileType(name: string): string {
  const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  return FILE_TYPES[ext] || "File";
}

async function refreshMicrosoftToken(conn: any) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      scope: "offline_access Mail.Read Files.Read",
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

async function getExcelContent(fileId: string, token: string): Promise<string> {
  try {
    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/createSession`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ persistChanges: false }) }
    );
    const session = await sessionRes.json();
    const sheetsRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
      { headers: { Authorization: `Bearer ${token}`, "workbook-session-id": session.id || "" } }
    );
    const sheetsData = await sheetsRes.json();
    if (!sheetsData.value?.length) return "";
    const sheetName = encodeURIComponent(sheetsData.value[0].name);
    const rangeRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetName}/usedRange`,
      { headers: { Authorization: `Bearer ${token}`, "workbook-session-id": session.id || "" } }
    );
    const rangeData = await rangeRes.json();
    if (!rangeData.values?.length) return "";
    return rangeData.values.slice(0, 50).map((row: any[]) => row.join(" | ")).join("\n");
  } catch { return ""; }
}

async function syncUserMicrosoftFiles(userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!conn) return { synced: 0 };

  let token = conn.access_token;
  if (new Date(conn.expires_at) < new Date()) {
    token = await refreshMicrosoftToken(conn);
  }

  const { data: lastEvent } = await supabaseAdmin
    .from("company_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("source", "OneDrive")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const afterDate = lastEvent
    ? new Date(lastEvent.created_at).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recently modified files from OneDrive
  const filesRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root/children?$top=20&$select=id,name,file,lastModifiedDateTime,lastModifiedBy,size&$filter=lastModifiedDateTime gt ${afterDate}&$orderby=lastModifiedDateTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const filesData = await filesRes.json();
  const files = (filesData.value || []).filter((f: any) => f.file); // Only files not folders

  if (!files.length) return { synced: 0 };

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_brief")
    .eq("user_id", userId)
    .single();

  let synced = 0;
  let hasImportant = false;

  for (const file of files) {
    try {
      const fileType = getFileType(file.name);
      const modifier = file.lastModifiedBy?.user?.displayName || "Unknown";

      let content = "";
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        content = await getExcelContent(file.id, token);
      }

      const rawData = `File: ${file.name}
Type: ${fileType}
Last Modified: ${file.lastModifiedDateTime}
Modified By: ${modifier}
Size: ${file.size ? Math.round(file.size / 1024) + "KB" : "unknown"}
${content ? `\nContent Preview:\n${content.slice(0, 1500)}` : ""}`;

      const eventRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          source: "OneDrive",
          eventType: `${fileType.toLowerCase().replace(/ /g, "_")}_modified`,
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
    .from("microsoft_connections")
    .select("user_id");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;
  for (const conn of connections) {
    try {
      const result = await syncUserMicrosoftFiles(conn.user_id);
      totalSynced += result.synced;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, totalSynced });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const result = await syncUserMicrosoftFiles(userId);
  return NextResponse.json({ success: true, ...result });
}
