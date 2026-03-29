import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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

export async function POST() {
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
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: conn } = await supabaseAdmin
      .from("quickbooks_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!conn) return NextResponse.json({ error: "QuickBooks not connected" });

    const token = await refreshQuickBooksToken(conn);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("company_brief")
      .eq("user_id", user.id)
      .single();

    // Fetch recent invoices
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
          userId: user.id,
          source: "QuickBooks",
          eventType: "invoice",
          rawData,
          companyContext: profile?.company_brief || "",
        }),
      });

      synced++;
      await new Promise(r => setTimeout(r, 300));
    }

    // Rebuild snapshot after syncing
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
      method: "POST",
    });

    return NextResponse.json({ success: true, synced });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
