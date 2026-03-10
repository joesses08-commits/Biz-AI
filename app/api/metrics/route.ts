import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { computeMetrics } from "@/lib/metrics";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const metrics = await computeMetrics(user.id);
    if (!metrics) {
      return NextResponse.json({ error: "No data found. Please upload CSV files first." }, { status: 404 });
    }
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("Metrics error:", err);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
