import { getUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "No fileId" });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", await getUserId()).single();
  if (!conn) return NextResponse.json({ error: "Not connected" });

  const headers = {
    Authorization: `Bearer ${conn.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    // Create a session first
    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/createSession`,
      { method: "POST", headers, body: JSON.stringify({ persistChanges: false }) }
    );
    const session = await sessionRes.json();
    console.log("Session:", JSON.stringify(session).slice(0, 200));

    const sessionHeaders = {
      ...headers,
      "workbook-session-id": session.id || "",
    };

    // Get worksheets
    const sheetsRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
      { headers: sessionHeaders }
    );
    const sheetsData = await sheetsRes.json();
    console.log("Sheets:", JSON.stringify(sheetsData).slice(0, 200));
    const sheets = sheetsData.value || [];
    if (sheets.length === 0) return NextResponse.json({ error: "No sheets found" });

    const sheetName = encodeURIComponent(sheets[0].name);
    const rangeRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetName}/usedRange`,
      { headers: sessionHeaders }
    );
    const rangeData = await rangeRes.json();
    console.log("Range:", JSON.stringify(rangeData).slice(0, 200));

    return NextResponse.json({
      connected: true,
      sheetName: sheets[0].name,
      data: rangeData.values || [],
      rowCount: rangeData.values?.length || 0,
    });
  } catch (e) {
    console.error("Excel error:", e);
    return NextResponse.json({ error: "Failed to read file" });
  }
}
