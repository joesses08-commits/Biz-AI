import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", "demo-user").single();
  if (!conn) return NextResponse.json({ connected: false });

  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,isRead,bodyPreview", {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    const data = await res.json();
    return NextResponse.json({ connected: true, email: conn.email, emails: data.value || [] });
  } catch {
    return NextResponse.json({ connected: true, email: conn.email, emails: [] });
  }
}
