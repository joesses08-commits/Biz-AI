import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function decodeBase64(str: string) {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch { return ""; }
}

function extractEmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractEmailBody(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

async function registerGmailPush(accessToken: string) {
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        labelIds: ["INBOX"],
        topicName: "projects/biz-ai-489803/topics/gmail-push",
      }),
    });
    const data = await res.json();
    return data.historyId;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=gmail_denied`);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=gmail_failed`);
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

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
    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

    // Register Gmail push notifications
    const historyId = await registerGmailPush(tokens.access_token);

    await supabase.from("gmail_connections").upsert({
      user_id: user.id,
      email: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiryDate.toISOString(),
      last_history_id: historyId || null,
    }, { onConflict: "user_id" });

    // Initial email scan in background
    initialEmailScan(user.id, tokens.access_token).catch(() => {});

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?success=gmail`);

  } catch (err) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=gmail_failed`);
  }
}

async function initialEmailScan(userId: string, accessToken: string) {
  try {
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const companyContext = profile?.company_brief || "";

    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages?.length) return;

    for (const msg of listData.messages.slice(0, 20)) {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        const headers = data.payload?.headers || [];
        const subject = getHeader(headers, "subject") || "(No subject)";
        const from = getHeader(headers, "from") || "Unknown";
        const date = getHeader(headers, "date") || "";
        const body = extractEmailBody(data.payload).slice(0, 1000);
        const isUnread = data.labelIds?.includes("UNREAD") ? "UNREAD" : "READ";

        const rawData = `FROM: ${from}\nDATE: ${date}\nSUBJECT: ${subject}\nSTATUS: ${isUnread}\nBODY: ${body}`;

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            source: "Gmail",
            eventType: "email",
            rawData,
            companyContext,
          }),
        });

        await new Promise(r => setTimeout(r, 500));
      } catch { continue; }
    }

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });

  } catch (err) {
    console.error("Initial email scan error:", err);
  }
}
