import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
    if (!user) return NextResponse.json({ connected: false });

    const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ connected: false });

    let token = conn.access_token;

    if (new Date(conn.token_expiry) < new Date()) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: conn.refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        token = refreshData.access_token;
        await supabase.from("gmail_connections").update({
          access_token: token,
          token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        }).eq("user_id", user.id);
      }
    }

    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=50&orderBy=modifiedTime desc",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    if (data.error) return NextResponse.json({ connected: true, files: [], error: data.error.message });

    return NextResponse.json({ connected: true, files: data.files || [] });
  } catch (err) {
    return NextResponse.json({ connected: true, files: [], error: String(err) });
  }
}
