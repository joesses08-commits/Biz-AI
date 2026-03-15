import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", "demo-user").single();
  if (!conn) return NextResponse.json({ connected: false });

  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50&$select=id,name,size,lastModifiedDateTime,file,parentReference",
      { headers: { Authorization: `Bearer ${conn.access_token}` } }
    );
    const data = await res.json();
    const excelFiles = (data.value || []).filter((f: any) =>
      f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls")
    );
    return NextResponse.json({ connected: true, files: excelFiles });
  } catch (e) {
    return NextResponse.json({ connected: true, files: [], error: String(e) });
  }
}
