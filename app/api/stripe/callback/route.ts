import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/integrations?error=stripe", process.env.NEXT_PUBLIC_APP_URL!));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/integrations?error=stripe", process.env.NEXT_PUBLIC_APP_URL!));
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_secret: process.env.STRIPE_SECRET_KEY!,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.redirect(new URL("/integrations?error=stripe", process.env.NEXT_PUBLIC_APP_URL!));
    }

    // Save to Supabase
    await supabase.from("stripe_connections").upsert({
      user_id: state,
      stripe_user_id: tokenData.stripe_user_id,
      access_token: tokenData.access_token,
      scope: tokenData.scope,
    });

    return NextResponse.redirect(new URL("/integrations?success=stripe", process.env.NEXT_PUBLIC_APP_URL!));
  } catch {
    return NextResponse.redirect(new URL("/integrations?error=stripe", process.env.NEXT_PUBLIC_APP_URL!));
  }
}
