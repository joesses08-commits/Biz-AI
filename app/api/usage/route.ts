import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabaseAdmin
      .from("api_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true });

    if (!data?.length) return NextResponse.json({ totalCost: 0, totalCalls: 0, byFeature: {}, byDay: [] });

    const totalCost = data.reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
    const totalCalls = data.length;

    const byFeature: Record<string, { calls: number; cost: number }> = {};
    const byDayMap: Record<string, number> = {};

    for (const row of data) {
      // by feature
      if (!byFeature[row.feature]) byFeature[row.feature] = { calls: 0, cost: 0 };
      byFeature[row.feature].calls++;
      byFeature[row.feature].cost += row.cost_usd || 0;

      // by day
      const day = new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDayMap[day] = (byDayMap[day] || 0) + (row.cost_usd || 0);
    }

    // Fill in missing days with 0
    const byDay = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDay.push({ date: label, cost: byDayMap[label] || 0 });
    }

    return NextResponse.json({ totalCost, totalCalls, byFeature, byDay });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
