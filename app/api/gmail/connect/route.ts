import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;

  const scopes = [
    // Gmail — read + send (gmail.modify)
    "https://www.googleapis.com/auth/gmail.modify",
    // Drive — full read + write
    "https://www.googleapis.com/auth/drive",
    // Sheets — read + write
    "https://www.googleapis.com/auth/spreadsheets",
    // User info
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  return NextResponse.redirect(authUrl);
}
