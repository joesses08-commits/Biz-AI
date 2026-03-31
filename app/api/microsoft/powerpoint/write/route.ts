import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getMicrosoftToken(conn: any, supabase: any) {
  let token = conn.access_token;
  if (new Date(conn.expires_at) < new Date()) {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        grant_type: "refresh_token",
        scope: "offline_access Files.Read.All Files.ReadWrite.All",
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      token = data.access_token;
      await supabase.from("microsoft_connections").update({
        access_token: token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", conn.user_id);
    }
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });

    const { action, fileName } = await req.json();
    const token = await getMicrosoftToken(conn, supabase);

    // CREATE new PowerPoint file
    if (action === "create") {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName || "Jimmy AI Presentation"}.pptx:/content`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
        body: new Uint8Array(0),
      });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true, fileId: data.id, url: data.webUrl });
    }

    return NextResponse.json({ error: "Invalid action. Use: create" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
