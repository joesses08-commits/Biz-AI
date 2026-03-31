import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshGoogleToken(conn: any): Promise<string> {
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
  if (data.access_token) return data.access_token;
  return conn.access_token;
}

export async function GET(request: NextRequest) {
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

    const { data: conn } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    let token = conn.access_token;
    if (new Date(conn.token_expiry) < new Date()) token = await refreshGoogleToken(conn);

    const filesRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&pageSize=10&fields=files(id,name)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const filesData = await filesRes.json();
    const files = filesData.files || [];

    const results = [];
    for (const file of files.slice(0, 5)) {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await metaRes.json();
      const tabs = (meta.sheets || []).map((s: any) => s.properties?.title);

      const tabData = [];
      for (const tab of tabs) {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(tab)}!A1:Z20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        tabData.push({ tab, rows: data.values?.length || 0, sample: data.values?.slice(0, 3) });
      }

      results.push({ file: file.name, tabs, tabData });
    }

    return NextResponse.json({ files: results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
