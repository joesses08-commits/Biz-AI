import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("gmail_connections")
    .select("email, user_id")
    .limit(1)
    .single();

  if (!data) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, email: data.email, userId: data.user_id });
}
