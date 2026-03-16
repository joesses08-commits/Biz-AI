import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = await getUserId();

  const { data } = await supabase
    .from("stripe_connections")
    .select("stripe_user_id")
    .eq("user_id", userId)
    .single();

  if (!data) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true });
}
