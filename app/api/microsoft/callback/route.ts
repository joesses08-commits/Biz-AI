import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { microsoftInitialBackfill } from "@/lib/initial-backfill";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(new URL(`/integrations?error=microsoft_denied&reason=${encodeURIComponent(errorDesc || error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/integrations?error=microsoft_no_code", request.url));
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      const reason = encodeURIComponent(tokens.error_description || tokens.error || "no_token");
      return NextResponse.redirect(new URL(`/integrations?error=microsoft_token_failed&reason=${reason}`, request.url));
    }

    const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();

    const { error: dbError } = await supabase.from("microsoft_connections").upsert({
      user_id: user.id,
      email: userData.mail || userData.userPrincipalName || user.email || "",
      display_name: userData.displayName || "",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      initial_sync_done: false,
    }, { onConflict: "user_id" });

    if (dbError) {
      return NextResponse.redirect(new URL(`/integrations?error=microsoft_db_failed&reason=${encodeURIComponent(dbError.message)}`, request.url));
    }

    // Run full historical backfill in background
    microsoftInitialBackfill(user.id, tokens.access_token).catch(() => {});

    return NextResponse.redirect(new URL("/integrations?success=microsoft", request.url));
  } catch (err) {
    return NextResponse.redirect(new URL(`/integrations?error=microsoft_exception&reason=${encodeURIComponent(String(err))}`, request.url));
  }
}
