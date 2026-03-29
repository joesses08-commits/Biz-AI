import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

    const base = process.env.NEXT_PUBLIC_APP_URL!;
    const userHeader = { "Content-Type": "application/json", "x-user-id": user.id };

    const results = await Promise.allSettled([
      fetch(`${base}/api/gmail/sync`, { method: "POST", headers: userHeader }).then(r => r.json()),
      fetch(`${base}/api/microsoft/sync`, { method: "POST", headers: userHeader }).then(r => r.json()),
      fetch(`${base}/api/quickbooks/sync`, { method: "POST", headers: userHeader }).then(r => r.json()),
    ]);

    await fetch(`${base}/api/events/snapshot`, { method: "POST" });

    return NextResponse.json({
      success: true,
      gmail: results[0].status === "fulfilled" ? results[0].value : "failed",
      microsoft: results[1].status === "fulfilled" ? results[1].value : "failed",
      quickbooks: results[2].status === "fulfilled" ? results[2].value : "failed",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
