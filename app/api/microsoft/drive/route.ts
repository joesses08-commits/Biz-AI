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

    const headers = { Authorization: `Bearer ${token}` };

    // Search entire drive for all file types
    const [allRes, xlsRes, docRes, pptRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='')??$top=100&$select=id,name,size,lastModifiedDateTime,file,parentReference", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')?$top=50&$select=id,name,size,lastModifiedDateTime,file,parentReference", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.docx')?$top=50&$select=id,name,size,lastModifiedDateTime,file,parentReference", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pptx')?$top=50&$select=id,name,size,lastModifiedDateTime,file,parentReference", { headers }),
    ]);

    const [allData, xlsData, docData, pptData] = await Promise.all([
      allRes.json(), xlsRes.json(), docRes.json(), pptRes.json()
    ]);

    // Merge and deduplicate all files
    const allFiles = [
      ...(allData.value || []),
      ...(xlsData.value || []),
      ...(docData.value || []),
      ...(pptData.value || []),
    ].filter(f => f.file); // only files not folders

    const seen = new Set();
    const files = allFiles.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    return NextResponse.json({ connected: true, email: conn.email, files });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
