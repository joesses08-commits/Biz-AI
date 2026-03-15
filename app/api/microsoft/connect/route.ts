import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI!;

  const scope = "openid email profile User.Read Mail.Read Calendars.Read Files.Read.All offline_access";

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("response_mode", "query");

  return NextResponse.redirect(authUrl.toString());
}
