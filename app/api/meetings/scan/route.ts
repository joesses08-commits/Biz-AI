import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST() {
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

    const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

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

    // Search for Google Meet transcripts in Drive
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name contains 'Meet' and (mimeType='application/vnd.google-apps.document' or mimeType='text/plain')&fields=files(id,name,createdTime,modifiedTime)&pageSize=20&orderBy=createdTime desc",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const files = searchData.files || [];

    // Get already processed file IDs
    const { data: existingMeetings } = await supabase
      .from("meetings")
      .select("drive_file_id")
      .eq("user_id", user.id)
      .not("drive_file_id", "is", null);

    const processedIds = new Set((existingMeetings || []).map((m: any) => m.drive_file_id));
    const newFiles = files.filter((f: any) => !processedIds.has(f.id));

    const processed = [];

    for (const file of newFiles.slice(0, 5)) {
      try {
        // Export as plain text
        const contentRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const transcript = await contentRes.text();

        if (transcript.length < 200) continue;

        // Process via our meetings API
        const processRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/meetings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieStore.toString() },
          body: JSON.stringify({
            transcript,
            title: file.name,
            source: "google_meet",
            drive_file_id: file.id,
          }),
        });

        const result = await processRes.json();
        if (result.meeting) processed.push(result.meeting);
      } catch { continue; }
    }

    return NextResponse.json({ scanned: files.length, new_found: newFiles.length, processed: processed.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
