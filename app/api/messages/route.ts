import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/notify";
import { createPortalNotification } from "@/lib/notify-portal";

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

  const { data: tracks } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("id, product_id, factory_id, status, factory_catalog(id, name), plm_products(id, name, sku, images)")
    .eq("user_id", user.id);

  if (!tracks || tracks.length === 0) return NextResponse.json({ chats: [] });

  const trackIds = tracks.map((t: any) => t.id);

  const { data: messages } = await supabaseAdmin
    .from("track_messages")
    .select("*")
    .in("track_id", trackIds)
    .order("created_at", { ascending: false });

  const { data: pinned } = await supabaseAdmin
    .from("pinned_chats")
    .select("track_id")
    .eq("user_id", user.id);

  const pinnedIds = new Set((pinned || []).map((p: any) => p.track_id));

  const { data: members } = await supabaseAdmin
    .from("track_chat_members")
    .select("track_id, user_id, profiles(full_name, email)")
    .in("track_id", trackIds);

  const chats = tracks
    .filter((t: any) => {
      const trackMsgs = (messages || []).filter((m: any) => m.track_id === t.id);
      return trackMsgs.length > 0;
    })
    .map((t: any) => {
      const trackMsgs = (messages || []).filter((m: any) => m.track_id === t.id);
      const latest = trackMsgs[0];
      const unread = trackMsgs.filter((m: any) => (m.sender_role === "factory" || m.sender_role === "designer") && !m.read_by_admin).length;
      const trackMembers = (members || []).filter((m: any) => m.track_id === t.id);
      return {
        track_id: t.id,
        product_id: t.product_id,
        product_name: t.plm_products?.name,
        product_sku: t.plm_products?.sku,
        product_image: t.plm_products?.images?.[0],
        factory_name: t.factory_catalog?.name,
        factory_id: t.factory_id,
        latest_message: latest,
        unread_count: unread,
        total_messages: trackMsgs.length,
        is_pinned: pinnedIds.has(t.id),
        members: trackMembers,
      };
    })
    .sort((a: any, b: any) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.latest_message?.created_at || 0).getTime() - new Date(a.latest_message?.created_at || 0).getTime();
    });

  // Add warehouse chats
  const { data: warehouseMsgs } = await supabaseAdmin
    .from("warehouse_messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const warehouseIds = Array.from(new Set((warehouseMsgs || []).map((m: any) => m.warehouse_id)));
  const { data: warehouseNames } = warehouseIds.length > 0
    ? await supabaseAdmin.from("warehouses").select("id, name").in("id", warehouseIds)
    : { data: [] };
  const warehouseNameMap: Record<string, string> = {};
  for (const w of (warehouseNames || [])) warehouseNameMap[w.id] = w.name;

  const warehouseThreadMap: Record<string, any> = {};
  for (const m of (warehouseMsgs || [])) {
    if (!warehouseThreadMap[m.warehouse_id]) {
      warehouseThreadMap[m.warehouse_id] = {
        track_id: "warehouse_" + m.warehouse_id,
        warehouse_id: m.warehouse_id,
        user_id: m.user_id,
        product_name: warehouseNameMap[m.warehouse_id] || "Warehouse",
        factory_name: "Warehouse",
        product_image: null,
        latest_message: m,
        unread_count: 0,
        is_pinned: false,
        is_warehouse: true,
      };
    }
  }
  const warehouseChats = Object.values(warehouseThreadMap);

  return NextResponse.json({ chats: [...warehouseChats, ...chats] });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, track_id } = body;

  if (action === "pin") {
    await supabaseAdmin.from("pinned_chats").upsert({ user_id: user.id, track_id });
    return NextResponse.json({ success: true });
  }

  if (action === "unpin") {
    await supabaseAdmin.from("pinned_chats").delete().eq("user_id", user.id).eq("track_id", track_id);
    return NextResponse.json({ success: true });
  }

  if (action === "add_member") {
    const { member_user_id } = body;
    const { data: existing } = await supabaseAdmin
      .from("track_chat_members")
      .select("id")
      .eq("track_id", track_id)
      .eq("user_id", member_user_id)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin.from("track_chat_members").insert({ track_id, user_id: member_user_id, added_by: user.id });
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, already_existed: !!existing });
  }

  if (action === "add_members_bulk") {
    // Add multiple members to multiple tracks at once
    const { member_user_ids, track_ids } = body;
    for (const tid of (track_ids || [track_id])) {
      for (const uid of (member_user_ids || [])) {
        const { data: existing } = await supabaseAdmin
          .from("track_chat_members")
          .select("id")
          .eq("track_id", tid)
          .eq("user_id", uid)
          .maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("track_chat_members").insert({ track_id: tid, user_id: uid, added_by: user.id });
        }
      }
    }
    return NextResponse.json({ success: true });
  }

  if (action === "remove_member") {
    const { member_user_id } = body;
    await supabaseAdmin.from("track_chat_members").delete().eq("track_id", track_id).eq("user_id", member_user_id);
    return NextResponse.json({ success: true });
  }

  if (action === "get_messages") {
    const { data } = await supabaseAdmin.from("track_messages")
      .select("*").eq("track_id", track_id).order("created_at", { ascending: true });
    await supabaseAdmin.from("track_messages").update({ read_by_admin: true })
      .eq("track_id", track_id).neq("sender_role", "admin").eq("read_by_admin", false);
    return NextResponse.json({ messages: data || [] });
  }

  if (action === "send_message") {
    const { message, attachment_url, attachment_type, attachment_name } = body;
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).single();
    const senderName = profile?.full_name || user.email || "Admin";
    await supabaseAdmin.from("track_messages").insert({
      track_id, product_id: body.product_id, user_id: user.id,
      sender_role: "admin", sender_name: senderName, message: message || "",
      attachment_url: attachment_url || null, attachment_type: attachment_type || null, attachment_name: attachment_name || null,
    });
    // Notify factory portal users in this track
    try {
      const { data: trackInfo } = await supabaseAdmin.from("plm_factory_tracks").select("factory_id, plm_products(name)").eq("id", track_id).single();
      if (trackInfo?.factory_id) {
        const { data: factoryUsers } = await supabaseAdmin.from("factory_portal_users").select("id").eq("factory_id", trackInfo.factory_id);
        const productName = (trackInfo as any).plm_products?.name || "Product";
        for (const fu of (factoryUsers || [])) {
          await createPortalNotification({ portal_user_id: fu.id, type: "message", title: "New message — " + productName, body: senderName + ": " + (message || "Attachment"), link: "/portal/messages" });
        }
      }
    } catch {}
    // Notify team members in this chat
    const { data: members } = await supabaseAdmin.from("track_chat_members").select("user_id").eq("track_id", track_id);
    const { data: trackInfo } = await supabaseAdmin.from("plm_factory_tracks").select("plm_products(name)").eq("id", track_id).single();
    const productName = (trackInfo as any)?.plm_products?.name || "Product";
    for (const m of (members || [])) {
      if (m.user_id !== user.id) {
        // Try admin notification first
        await createNotification({ user_id: m.user_id, type: "message", title: "New message — " + productName, body: message || "Attachment", link: "/messages" }).catch(() => {});
        // Also try portal notification (for designers)
        await createPortalNotification({ portal_user_id: m.user_id, type: "message", title: "New message — " + productName, body: senderName + ": " + (message || "Attachment"), link: "/designer-messages" }).catch(() => {});
      }
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
