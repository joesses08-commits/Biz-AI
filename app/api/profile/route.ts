import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: cp }, { data: cs }, { data: pr }] = await Promise.all([
    admin.from("company_profiles").select("company_name").eq("user_id", user.id).single(),
    admin.from("company_settings").select("address").eq("user_id", user.id).single(),
    admin.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  return NextResponse.json({
    profile: {
      company_name: cp?.company_name || "",
      full_name: pr?.full_name || "",
      address: cs?.address || "",
    }
  });
}
