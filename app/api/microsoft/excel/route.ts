import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", "demo-user").single();
  if (!conn) return NextResponse.json({ connected: false });

  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/search(q='.xlsx')?$select=id,name,size,lastModifiedDateTime,parentReference&$top=50",
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const data = await res.json();
    console.log("Excel search result:", JSON.stringify(data).slice(0, 500));
    return NextResponse.json({ connected: true, files: data.value || [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ connected: true, files: [] });
  }
}
