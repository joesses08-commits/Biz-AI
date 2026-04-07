import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash } from "crypto";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, is_designer").eq("id", user.id).single();
  if (!profile?.is_designer) return NextResponse.json({ error: "Not a designer" }, { status: 403 });
  const { data: portalUser } = await supabaseAdmin.from("factory_portal_users").select("name, email, pin_hash, company_name, address").eq("supabase_user_id", user.id).single();
  return NextResponse.json({
    name: portalUser?.name || profile.full_name || "",
    email: user.email || "",
    company_name: portalUser?.company_name || "",
    address: portalUser?.address || "",
    has_pin: !!portalUser?.pin_hash,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from("profiles").select("is_designer").eq("id", user.id).single();
  if (!profile?.is_designer) return NextResponse.json({ error: "Not a designer" }, { status: 403 });
  const body = await req.json();

  if (body.action === "update_profile") {
    const { name, company_name, address } = body;
    await supabaseAdmin.from("factory_portal_users").update({ name, company_name, address }).eq("supabase_user_id", user.id);
    await supabaseAdmin.from("profiles").update({ full_name: name }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }
  if (body.action === "set_pin") {
    const { pin } = body;
    if (!pin || pin.length < 4) return NextResponse.json({ error: "PIN too short" }, { status: 400 });
    await supabaseAdmin.from("factory_portal_users").update({ pin_hash: createHash("sha256").update(pin).digest("hex") }).eq("supabase_user_id", user.id);
    return NextResponse.json({ success: true });
  }
  if (body.action === "verify_pin") {
    const { pin } = body;
    const { data: pu } = await supabaseAdmin.from("factory_portal_users").select("pin_hash").eq("supabase_user_id", user.id).single();
    if (!pu?.pin_hash) return NextResponse.json({ error: "No PIN set" }, { status: 400 });
    if (pu.pin_hash === createHash("sha256").update(pin).digest("hex")) return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
