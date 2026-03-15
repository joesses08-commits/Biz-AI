import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "No fileId" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", "demo-user").single();
  if (!conn) return NextResponse.json({ error: "Not connected" });

  try {
    // Get spreadsheet metadata
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`,
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const meta = await metaRes.json();
    const sheetName = meta.sheets?.[0]?.properties?.title || "Sheet1";

    // Get data from first sheet
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(sheetName)}`,
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const data = await dataRes.json();

    return NextResponse.json({
      connected: true,
      sheetName,
      title: meta.title,
      data: data.values || [],
      rowCount: data.values?.length || 0,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to read sheet" });
  }
}
