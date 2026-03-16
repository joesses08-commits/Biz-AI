import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("gmail_connections").select("*").limit(1).single();
  if (!conn) return NextResponse.json({ connected: false });

  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime,webViewLink)&pageSize=20",
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const data = await res.json();
    return NextResponse.json({ connected: true, files: data.files || [] });
  } catch {
    return NextResponse.json({ connected: true, files: [] });
  }
}
