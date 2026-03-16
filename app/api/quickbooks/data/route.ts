import { getUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  return res.json();
}

export async function GET() {
  const supabase = createServerClient();

  const { data: conn } = await supabase
    .from("quickbooks_connections")
    .select("*")
    .eq("user_id", await getUserId())
    .single();

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  let accessToken = conn.access_token;

  if (new Date(conn.expires_at) < new Date()) {
    const newTokens = await refreshAccessToken(conn.refresh_token);
    if (newTokens.access_token) {
      accessToken = newTokens.access_token;
      await supabase.from("quickbooks_connections").upsert({
        user_id: await getUserId(),
        realm_id: conn.realm_id,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      });
    }
  }

  const baseUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${conn.realm_id}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  const plRes = await fetch(
    `${baseUrl}/reports/ProfitAndLoss?summarize_column_by=Total`,
    { headers }
  );
  const plData = await plRes.json();

  const invoiceRes = await fetch(
    `${baseUrl}/query?query=SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 10`,
    { headers }
  );
  const invoiceData = await invoiceRes.json();

  return NextResponse.json({
    connected: true,
    profitAndLoss: plData,
    invoices: invoiceData?.QueryResponse?.Invoice || [],
  });
}
