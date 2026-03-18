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
      scope: "offline_access Mail.Read Calendars.Read Files.Read.All",
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    await supabase.from("microsoft_connections").update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }).eq("user_id", conn.user_id);
    return data.access_token;
  }
  return conn.access_token;
}

function parseVTT(vtt: string): string {
  // Strip VTT formatting and return clean transcript text
  return vtt
    .split("\n")
    .filter(line =>
      line.trim() &&
      !line.startsWith("WEBVTT") &&
      !line.match(/^\d+$/) &&
      !line.match(/^\d{2}:\d{2}:\d{2}/) &&
      !line.match(/^NOTE/)
    )
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });

    let token = conn.access_token;
    if (new Date(conn.expires_at) < new Date()) token = await refreshToken(conn, supabase);

    const headers = { Authorization: `Bearer ${token}` };

    // Search OneDrive for Teams transcript files (.vtt) and recording folders
    const [vttRes, recordingsRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.vtt')?$top=20&$select=id,name,createdDateTime,parentReference", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='Recordings')?$top=10&$select=id,name,createdDateTime,folder,parentReference", { headers }),
    ]);

    const [vttData, recordingsData] = await Promise.all([vttRes.json(), recordingsRes.json()]);

    const vttFiles = (vttData.value || []).filter((f: any) => f.name?.endsWith(".vtt"));

    // Get already processed file IDs
    const { data: existingMeetings } = await supabase
      .from("meetings")
      .select("drive_file_id")
      .eq("user_id", user.id)
      .not("drive_file_id", "is", null);

    const processedIds = new Set((existingMeetings || []).map((m: any) => m.drive_file_id));
    const newFiles = vttFiles.filter((f: any) => !processedIds.has(f.id));

    const processed = [];

    for (const file of newFiles.slice(0, 5)) {
      try {
        // Download the VTT file content
        const contentRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
          { headers }
        );
        const rawVtt = await contentRes.text();
        const transcript = parseVTT(rawVtt);

        if (transcript.length < 100) continue;

        // Process via meetings API
        const processRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/meetings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookieStore.toString() },
          body: JSON.stringify({
            transcript,
            title: file.name.replace(".vtt", "").replace(/_/g, " "),
            source: "teams",
            drive_file_id: file.id,
          }),
        });

        const result = await processRes.json();
        if (result.meeting) processed.push(result.meeting);
      } catch { continue; }
    }

    return NextResponse.json({
      scanned: vttFiles.length,
      new_found: newFiles.length,
      processed: processed.length,
      recordings_folders: (recordingsData.value || []).length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
