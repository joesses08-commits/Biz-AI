import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getGoogleToken(userId: string, supabase: any) {
  const { data: conn } = await supabase.from("gmail_connections").select("*").eq("user_id", userId).single();
  if (!conn) return null;
  let token = conn.access_token;
  if (new Date(conn.token_expiry) < new Date()) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: conn.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      token = data.access_token;
      await supabase.from("gmail_connections").update({
        access_token: token,
        token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", userId);
    }
  }
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, spreadsheetId, title, sheetName, rows, range, values } = await req.json();
    const token = await getGoogleToken(user.id, supabase);
    if (!token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    // CREATE new spreadsheet
    if (action === "create") {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: { title: title || "Jimmy AI Sheet" },
          sheets: [{ properties: { title: sheetName || "Sheet1" } }],
        }),
      });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true, spreadsheetId: data.spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}` });
    }

    // APPEND rows to existing sheet
    if (action === "append") {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range || "A1")}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: rows }),
        }
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    // UPDATE specific range
    if (action === "update") {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        }
      );
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action. Use: create, append, update" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
