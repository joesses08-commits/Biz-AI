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

    const { action, documentId, title, content } = await req.json();
    const token = await getGoogleToken(user.id, supabase);
    if (!token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    // CREATE new doc
    if (action === "create") {
      const res = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Jimmy AI Document" }),
      });
      const doc = await res.json();
      if (doc.error) return NextResponse.json({ error: doc.error.message }, { status: 400 });

      // Insert content if provided
      if (content) {
        await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{ insertText: { location: { index: 1 }, text: content } }],
          }),
        });
      }

      return NextResponse.json({ success: true, documentId: doc.documentId, url: `https://docs.google.com/document/d/${doc.documentId}` });
    }

    // APPEND to existing doc
    if (action === "append") {
      const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const doc = await docRes.json();
      const endIndex = doc.body?.content?.slice(-1)[0]?.endIndex - 1 || 1;

      const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ insertText: { location: { index: endIndex }, text: "\n" + content } }],
        }),
      });
      const data = await res.json();
      if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action. Use: create, append" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
