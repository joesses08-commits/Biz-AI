import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  console.log("QB Callback hit - code:", code ? "present" : "missing", "realmId:", realmId);

  if (!code || !realmId) {
    console.log("Missing code or realmId");
    return NextResponse.redirect(new URL("/quickbooks?error=missing_params", request.url));
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI!;

  console.log("ClientId present:", !!clientId, "Secret present:", !!clientSecret);

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenRes.json();
  console.log("Token response:", JSON.stringify(tokens));

  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/quickbooks?error=no_token", request.url));
  }

  const supabase = createServerClient();

  const { error } = await supabase.from("quickbooks_connections").upsert({
    user_id: "demo-user",
    realm_id: realmId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });

  console.log("Supabase upsert error:", error);

  return NextResponse.redirect(new URL("/quickbooks?connected=true", request.url));
}
