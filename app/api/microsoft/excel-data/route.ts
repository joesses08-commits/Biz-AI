import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) return NextResponse.json({ error: "No fileId provided" });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: conn } = await supabase
    .from("microsoft_connections")
    .select("*")
    .eq("user_id", "demo-user")
    .single();

  if (!conn) return NextResponse.json({ error: "Not connected" });

  const headers = {
    Authorization: `Bearer ${conn.access_token}`,
    "Content-Type": "application/json",
  };

  try {
    // Get worksheets
    const sheetsRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`,
      { headers }
    );
    const sheetsData = await sheetsRes.json();
    const sheets = sheetsData.value || [];

    if (sheets.length === 0) return NextResponse.json({ error: "No sheets found" });

    // Get data from first sheet
    const sheetName = sheets[0].name;
    const rangeRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets/${sheetName}/usedRange`,
      { headers }
    );
    const rangeData = await rangeRes.json();
    const values = rangeData.values || [];

    return NextResponse.json({
      connected: true,
      fileName: fileId,
      sheetName,
      data: values,
      rowCount: values.length,
    });
  } catch (error) {
    console.error("Excel read error:", error);
    return NextResponse.json({ error: "Failed to read Excel file" });
  }
}
