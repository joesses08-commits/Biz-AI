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
  const type = req.nextUrl.searchParams.get("type");
  if (type === "factories") {
    const { data } = await supabaseAdmin.from("factory_catalog").select("*").eq("user_id", user.id).order("name");
    return NextResponse.json({ factories: data || [] });
  }
  if (type === "products") {
    const { data } = await supabaseAdmin.from("product_catalog").select("*").eq("user_id", user.id).order("name");
    return NextResponse.json({ products: data || [] });
  }
  const [{ data: factories }, { data: products }] = await Promise.all([
    supabaseAdmin.from("factory_catalog").select("*").eq("user_id", user.id).order("name"),
    supabaseAdmin.from("product_catalog").select("*").eq("user_id", user.id).order("name"),
  ]);
  return NextResponse.json({ factories: factories || [], products: products || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { action } = body;

  if (action === "add_factory") {
    const { name, email, contact_name, notes } = body;
    if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("factory_catalog").insert({ user_id: user.id, name, email, contact_name, notes }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, factory: data });
  }

  if (action === "delete_factory") {
    await supabaseAdmin.from("factory_catalog").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "add_product") {
    const { name, description, specs, target_quantity } = body;
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("product_catalog").insert({ user_id: user.id, name, description, specs, target_quantity }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, product: data });
  }

  if (action === "delete_product") {
    await supabaseAdmin.from("product_catalog").delete().eq("id", body.id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
