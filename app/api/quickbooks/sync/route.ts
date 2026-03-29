import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshQuickBooksToken(conn: any) {
  try {
    const credentials = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${credentials}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
    });
    const data = await res.json();
    if (data.access_token) {
      await supabaseAdmin.from("quickbooks_connections").update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || conn.refresh_token,
      }).eq("user_id", conn.user_id);
      return data.access_token;
    }
  } catch {}
  return conn.access_token;
}

async function syncUserQuickBooks(userId: string) {
  const { data: conn } = await supabaseAdmin
    .from("quickbooks_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!conn) return { synced: 0 };

  const token = await refreshQuickBooksToken(conn);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const { data: profile } = await supabaseAdmin
    .from("company_profiles")
    .select("company_brief")
    .eq("user_id", userId)
    .single();

  const invoicesRes = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${conn.realm_id}/query?query=SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 20&minorversion=65`,
    { headers }
  );
  const invoicesData = await invoicesRes.json();
  const invoices = invoicesData.QueryResponse?.Invoice || [];

  let synced = 0;

  for (const inv of invoices) {
    const rawData = `Invoice #${inv.DocNumber}
Customer: ${inv.CustomerRef?.name || "Unknown"}
Total: $${inv.TotalAmt}
Balance Due: $${inv.Balance}
Date: ${inv.TxnDate}
Due Date: ${inv.DueDate || "not set"}
Status: ${inv.Balance > 0 ? "UNPAID" : "PAID"}`;

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        source: "QuickBooks",
        eventType: "invoice",
        rawData,
        companyContext: profile?.company_brief || "",
      }),
    });

    synced++;
    await new Promise(r => setTimeout(r, 300));
  }

  if (synced > 0) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
    });
  }

  return { synced };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabaseAdmin
    .from("quickbooks_connections")
    .select("user_id");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;
  for (const conn of connections) {
    try {
      const result = await syncUserQuickBooks(conn.user_id);
      totalSynced += result.synced;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, totalSynced });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const result = await syncUserQuickBooks(userId);
  return NextResponse.json({ success: true, ...result });
}
