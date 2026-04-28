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
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data: rows } = await supabaseAdmin
      .from("api_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false });

    const { data: monthRows } = await supabaseAdmin
      .from("api_usage")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", thisMonthStart);

    if (!rows?.length) return NextResponse.json({ rows: [], monthCost: 0, monthCalls: 0, totalCost: 0, totalCalls: 0 });

    const totalCost = rows.reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
    const totalCalls = rows.length;
    const monthCost = (monthRows || []).reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0);
    const monthCalls = (monthRows || []).length;

    return NextResponse.json({ rows, monthCost, monthCalls, totalCost, totalCalls });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
