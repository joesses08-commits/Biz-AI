import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as crypto from "crypto";

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

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("factory_portal_users")
    .select("id, name, email, factory_id, role, created_at, factory_catalog(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ users: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "create") {
    const { name, email, password, factory_id, role } = body;
    const password_hash = crypto.createHash("sha256").update(password).digest("hex");

    let supabase_user_id: string | null = null;

    // For designers: create a real Supabase auth user so they can log into myjimmy.ai
    if (role === "designer") {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          is_designer: true,
          admin_user_id: user.id,
        },
      });

      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
      supabase_user_id = authUser.user.id;

      // Create a profiles row for the designer pointing to admin's data
      await supabaseAdmin.from("profiles").upsert({
        id: supabase_user_id,
        full_name: name,
        onboarded: true,
        is_designer: true,
        admin_user_id: user.id,
      });
    }

    const { error } = await supabaseAdmin.from("factory_portal_users").insert({
      user_id: user.id,
      factory_id: factory_id || null,
      email: email.toLowerCase(),
      name,
      role: role || "factory",
      password_hash,
      supabase_user_id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    // If designer, also delete their Supabase auth user
    const { data: portalUser } = await supabaseAdmin.from("factory_portal_users")
      .select("supabase_user_id, role").eq("id", body.id).single();

    if (portalUser?.role === "designer" && portalUser?.supabase_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(portalUser.supabase_user_id);
    }

    await supabaseAdmin.from("factory_portal_users").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
