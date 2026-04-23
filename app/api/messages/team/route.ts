import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: members } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("admin_user_id", user.id)
    .eq("is_designer", true);

  // Get auth emails for each member
  const membersWithEmail = await Promise.all((members || []).map(async (m: any) => {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(m.id);
    return { ...m, email: authUser?.user?.email || "" };
  }));

  return NextResponse.json({ members: membersWithEmail });
}
