// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshGoogleToken(conn: any): Promise<string> {
  try {
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
      await supabaseAdmin.from("gmail_connections").update({
        access_token: data.access_token,
        token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", conn.user_id);
      return data.access_token;
    }
  } catch {}
  return conn.access_token;
}

export async function POST(request: NextRequest) {
  // DISABLED - old vision feature
  return Response.json({ success: true, skipped: true });
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

    const { source } = await request.json();

    // Create job
    const { data: job } = await supabaseAdmin
      .from("backfill_jobs")
      .insert({ user_id: user.id, source, status: "collecting" })
      .select()
      .single();

    if (!job) return NextResponse.json({ error: "Failed to create job" }, { status: 500 });

    if (source === "gmail") {
      const { data: conn } = await supabaseAdmin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle();
      if (!conn) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

      let token = conn.access_token;
      if (new Date(conn.token_expiry) < new Date()) token = await refreshGoogleToken(conn);

      const oneYearAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
      const allIds: { id: string; isSent: boolean }[] = [];

      // Just fetch IDs — super fast, no timeout risk
      for (const folder of ["in:inbox", "in:sent"]) {
        const isSent = folder === "in:sent";
        let pageToken = "";

        while (allIds.length < 500) {
          const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(`${folder} after:${oneYearAgo}`)}${pageToken ? `&pageToken=${pageToken}` : ""}`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          const messages = data.messages || [];
          if (!messages.length) break;

          for (const msg of messages) {
            allIds.push({ id: msg.id, isSent });
          }

          pageToken = data.nextPageToken || "";
          if (!pageToken) break;
        }
      }

      // Save all IDs to queue
      if (allIds.length) {
        const queueItems = allIds.map(({ id, isSent }) => ({
          job_id: job.id,
          user_id: user.id,
          source: "gmail",
          item_id: id,
          item_data: { isSent, token },
          processed: false,
        }));

        // Insert in batches of 100
        for (let i = 0; i < queueItems.length; i += 100) {
          await supabaseAdmin.from("backfill_queue").insert(queueItems.slice(i, i + 100));
        }
      }

      await supabaseAdmin.from("backfill_jobs").update({
        status: "processing",
        total_items: allIds.length,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);

      return NextResponse.json({ jobId: job.id, totalItems: allIds.length, source });
    }

    // For non-Gmail sources, process directly (they're fast enough)
    await supabaseAdmin.from("backfill_jobs").update({
      status: "processing",
      total_items: 1,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    return NextResponse.json({ jobId: job.id, totalItems: 1, source, direct: true });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
