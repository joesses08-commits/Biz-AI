import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getGoogleToken(userId: string, supabase: any) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).single();
  if (!conn) return null;
  let token = conn.access_token;
  if (new Date(conn.token_expiry) < new Date()) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      token = data.access_token;
      await supabase.from("gmail_connections").update({
        access_token: token,
        token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
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

    const { to, subject, body, replyToMessageId } = await req.json();
    if (!to || !subject || !body) return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });

    const token = await getGoogleToken(user.id, supabase);
    if (!token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    // Build RFC 2822 email
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body,
    ].join("\n");

    const encoded = Buffer.from(email).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const url = replyToMessageId
      ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
      : `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encoded, ...(replyToMessageId ? { threadId: replyToMessageId } : {}) }),
    });

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
