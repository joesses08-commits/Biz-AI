import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserId } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const tables: Record<string, string> = {
  gmail: "gmail_connections",
  stripe: "stripe_connections",
  quickbooks: "quickbooks_connections",
  microsoft: "microsoft_connections",
};

export async function POST(request: NextRequest) {
  const { integration } = await request.json();
  const userId = await getUserId();
  const table = tables[integration];

  if (!table) return NextResponse.json({ error: "Unknown integration" });

  // Try all possible user IDs
  await supabase.from(table).delete().eq("user_id", userId);
  await supabase.from(table).delete().eq("user_id", "demo-user");

  // For gmail, also try deleting all rows for this user
  if (integration === "gmail") {
    const { data: rows } = await supabase.from(table).select("id").limit(10);
    if (rows && rows.length > 0) {
      await supabase.from(table).delete().in("id", rows.map((r: any) => r.id));
    }
  }

  return NextResponse.json({ success: true });
}
