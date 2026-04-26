import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPortalUser(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("factory_portal_users")
    .select("*")
    .eq("session_token", token)
    .gt("session_expires_at", new Date().toISOString())
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("portal_notifications")
    .select("*")
    .eq("portal_user_id", portalUser.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const unread = (data || []).filter((n: any) => !n.read).length;
  return NextResponse.json({ notifications: data || [], unread });
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, id } = await req.json();

  if (action === "mark_read") {
    if (id === "all") {
      await supabaseAdmin.from("portal_notifications").update({ read: true }).eq("portal_user_id", portalUser.id);
    } else {
      await supabaseAdmin.from("portal_notifications").update({ read: true }).eq("id", id).eq("portal_user_id", portalUser.id);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
