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
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data } = await supabaseAdmin
      .from("api_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true });

    const { data: monthData } = await supabaseAdmin
      .from("api_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", thisMonthStart)
      .order("created_at", { ascending: true });

    if (!data?.length) return NextResponse.json({ totalCost: 0, totalCalls: 0, byFeature: {}, byDay: [], monthCost: 0, monthCalls: 0, monthByFeature: {} });

    const totalCost = data.reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
    const totalCalls = data.length;
    const monthCost = (monthData || []).reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
    const monthCalls = (monthData || []).length;

    const byFeature: Record<string, { calls: number; cost: number }> = {};
    const monthByFeature: Record<string, { calls: number; cost: number }> = {};
    const byDayMap: Record<string, number> = {};

    for (const row of data) {
      if (!byFeature[row.feature]) byFeature[row.feature] = { calls: 0, cost: 0 };
      byFeature[row.feature].calls++;
      byFeature[row.feature].cost += row.cost_usd || 0;
      const day = new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      byDayMap[day] = (byDayMap[day] || 0) + (row.cost_usd || 0);
    }

    for (const row of (monthData || [])) {
      if (!monthByFeature[row.feature]) monthByFeature[row.feature] = { calls: 0, cost: 0 };
      monthByFeature[row.feature].calls++;
      monthByFeature[row.feature].cost += row.cost_usd || 0;
    }

    const byDay = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      byDay.push({ date: label, cost: byDayMap[label] || 0 });
    }

    return NextResponse.json({ totalCost, totalCalls, byFeature, byDay, monthCost, monthCalls, monthByFeature });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
