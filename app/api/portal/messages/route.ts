import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notify";
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

  const { data: tracks } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("id, product_id, factory_catalog(id, name), plm_products(id, name, sku, images)")
    .eq("factory_id", portalUser.factory_id)
    .eq("user_id", portalUser.user_id);

  if (!tracks || tracks.length === 0) return NextResponse.json({ chats: [] });

  const trackIds = tracks.map((t: any) => t.id);

  const { data: messages } = await supabaseAdmin
    .from("track_messages")
    .select("*")
    .in("track_id", trackIds)
    .order("created_at", { ascending: false });

  const chats = tracks
    .filter((t: any) => (messages || []).some((m: any) => m.track_id === t.id))
    .map((t: any) => {
      const trackMsgs = (messages || []).filter((m: any) => m.track_id === t.id);
      const latest = trackMsgs[0];
      const unread = trackMsgs.filter((m: any) => (m.sender_role === "admin" || m.sender_role === "designer") && !m.read_by_factory).length;
      return {
        track_id: t.id,
        product_id: t.product_id,
        product_name: t.plm_products?.name,
        product_sku: t.plm_products?.sku,
        product_image: t.plm_products?.images?.[0],
        factory_name: t.factory_catalog?.name,
        latest_message: latest,
        unread_count: unread,
        total_messages: trackMsgs.length,
      };
    })
    .sort((a: any, b: any) => new Date(b.latest_message?.created_at || 0).getTime() - new Date(a.latest_message?.created_at || 0).getTime());

  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, track_id } = body;

  if (action === "get_messages") {
    const { data } = await supabaseAdmin.from("track_messages")
      .select("*").eq("track_id", track_id).order("created_at", { ascending: true });
    await supabaseAdmin.from("track_messages").update({ read_by_factory: true })
      .eq("track_id", track_id).eq("read_by_factory", false).neq("sender_role", "factory");
    return NextResponse.json({ messages: data || [] });
  }

  if (action === "send_message") {
    const { message, product_id, attachment_url, attachment_type, attachment_name } = body;
    await supabaseAdmin.from("track_messages").insert({
      track_id, product_id, user_id: portalUser.user_id,
      sender_role: "factory",
      sender_name: portalUser.name || portalUser.email || "Factory",
      message: message || "",
      attachment_url: attachment_url || null,
      attachment_type: attachment_type || null,
      attachment_name: attachment_name || null,
    });
    // Notify admin
    try {
      const { data: trackInfo } = await supabaseAdmin.from("plm_factory_tracks")
        .select("user_id, plm_products(name), factory_catalog(name)").eq("id", track_id).single();
      if (trackInfo) {
        const productName = (trackInfo as any).plm_products?.name || "Product";
        const factoryName = (trackInfo as any).factory_catalog?.name || portalUser.name || "Factory";
        await createNotification({
          user_id: (trackInfo as any).user_id,
          type: "message",
          title: "New message — " + productName,
          body: factoryName + ": " + (message || "Attachment"),
          link: "/portal/messages"
        });
      }
    } catch {}
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
