import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function decodeBase64(str: string) {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64(payload.body.data);
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: any[], name: string): string {
  if (!headers || !Array.isArray(headers)) return "";
  const found = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value || "";
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!connection) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

    let accessToken = connection.access_token;
    const expiry = new Date(connection.token_expiry);

    // Always try to refresh token
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: connection.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshResponse.json();

    if (refreshData.access_token) {
      accessToken = refreshData.access_token;
      await supabase.from("gmail_connections").update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      }).eq("user_id", user.id);
    } else {
      return NextResponse.json({ error: "Token refresh failed", refresh_error: refreshData }, { status: 401 });
    }

    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listResponse.json();

    if (listData.error) {
      return NextResponse.json({ error: listData.error.message, list_error: listData }, { status: 400 });
    }

    if (!listData.messages || listData.messages.length === 0) {
      return NextResponse.json({ emails: [], total: 0 });
    }

    // DEBUG: fetch first message and return full raw response
    const firstMsgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${listData.messages[0].id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const firstMsg = await firstMsgResponse.json();

    return NextResponse.json({
      debug: true,
      first_msg_raw: firstMsg,
      token_expiry_was: expiry.toISOString(),
      refresh_succeeded: !!refreshData.access_token,
    });

  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch emails", details: String(err) }, { status: 500 });
  }
}
