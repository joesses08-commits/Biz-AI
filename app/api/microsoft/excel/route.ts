import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function refreshToken(conn: any, supabase: any) {
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
    await supabase.from("microsoft_connections").update({
      access_token: data.access_token,
      token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", conn.user_id);
    return data.access_token;
  }
  return conn.access_token;
}

export async function GET() {
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

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ connected: false });

    let token = conn.access_token;
    if (new Date(conn.token_expiry) < new Date()) token = await refreshToken(conn, supabase);

    // Search entire OneDrive for Excel files
    const searchRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')?$top=20&$select=id,name,lastModifiedDateTime,size,parentReference",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const excelFiles = (searchData.value || []).filter((f: any) =>
      f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls")
    );

    if (!excelFiles.length) return NextResponse.json({ connected: true, files: [], sheets: [] });

    // Read data from each file
    const sheets: any[] = [];
    for (const file of excelFiles.slice(0, 5)) {
      try {
        const sessionRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/createSession`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ persistChanges: false }),
          }
        );
        const session = await sessionRes.json();
        const sessionHeaders = { Authorization: `Bearer ${token}`, "workbook-session-id": session.id || "" };

        const worksheetsRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets`,
          { headers: sessionHeaders }
        );
        const worksheetsData = await worksheetsRes.json();

        for (const worksheet of (worksheetsData.value || []).slice(0, 3)) {
          const rangeRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets/${encodeURIComponent(worksheet.name)}/usedRange`,
            { headers: sessionHeaders }
          );
          const rangeData = await rangeRes.json();
          if (rangeData.values?.length) {
            sheets.push({
              fileName: file.name,
              sheetName: worksheet.name,
              lastModified: file.lastModifiedDateTime,
              rows: rangeData.values.slice(0, 50),
              rowCount: rangeData.values.length,
            });
          }
        }
      } catch { continue; }
    }

    return NextResponse.json({ connected: true, files: excelFiles, sheets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
