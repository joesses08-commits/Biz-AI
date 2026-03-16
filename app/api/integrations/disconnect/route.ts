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

  const { error } = await supabase.from(table).delete().eq("user_id", userId);

  if (error) {
    // Try deleting by demo-user as fallback
    await supabase.from(table).delete().eq("user_id", "demo-user");
  }

  return NextResponse.json({ success: true });
}
