import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("gmail_connections").select("*").limit(1).single();
  if (!conn) return NextResponse.json({ connected: false });

  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=50&orderBy=modifiedTime desc",
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const data = await res.json();
    return NextResponse.json({ connected: true, files: data.files || [] });
  } catch {
    return NextResponse.json({ connected: true, files: [] });
  }
}
