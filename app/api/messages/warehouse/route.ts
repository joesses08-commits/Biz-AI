import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
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

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all warehouse threads for this user
  const { data: messages } = await supabaseAdmin
    .from("warehouse_messages")
    .select("*, warehouses(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Group by warehouse_id to get unique threads with last message
  const threadsMap: Record<string, any> = {};
  for (const m of (messages || [])) {
    if (!threadsMap[m.warehouse_id]) {
      threadsMap[m.warehouse_id] = {
        warehouse_id: m.warehouse_id,
        user_id: m.user_id,
        warehouse_name: m.warehouses?.name || "Warehouse",
        last_message: m.message,
        updated_at: m.created_at,
      };
    }
  }

  return NextResponse.json({ threads: Object.values(threadsMap) });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "get_messages") {
    const { warehouse_id } = body;
    const { data } = await supabaseAdmin
      .from("warehouse_messages")
      .select("*")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    // Mark all warehouse messages as read by admin
    await supabaseAdmin.from("warehouse_messages")
      .update({ read_by_admin: true })
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user.id)
      .eq("sender_role", "warehouse");
    return NextResponse.json({ messages: data || [] });
  }

  if (action === "send_message") {
    const { warehouse_id, message, sender_name } = body;
    await supabaseAdmin.from("warehouse_messages").insert({
      user_id: user.id,
      warehouse_id,
      message,
      sender_role: "admin",
      sender_name: sender_name || "Admin",
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
