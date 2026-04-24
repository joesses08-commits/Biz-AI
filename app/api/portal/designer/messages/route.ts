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

  // Get tracks for products assigned to this designer
  const { data: assignments } = await supabaseAdmin
    .from("plm_assignments")
    .select("product_id")
    .eq("designer_id", portalUser.id);

  const productIds = (assignments || []).map((a: any) => a.product_id);
  if (productIds.length === 0) return NextResponse.json({ chats: [], pinned: [] });

  const { data: tracks } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("id, product_id, factory_id, factory_catalog(id, name), plm_products(id, name, sku, images)")
    .in("product_id", productIds);

  if (!tracks || tracks.length === 0) return NextResponse.json({ chats: [], pinned: [] });

  const trackIds = tracks.map((t: any) => t.id);

  const { data: messages } = await supabaseAdmin
    .from("track_messages")
    .select("*")
    .in("track_id", trackIds)
    .order("created_at", { ascending: false });

  // Get chat members to check if designer is in the chat
  const { data: members } = await supabaseAdmin
    .from("track_chat_members")
    .select("track_id")
    .eq("user_id", portalUser.id)
    .in("track_id", trackIds);

  const memberTrackIds = new Set((members || []).map((m: any) => m.track_id));

  // Get pinned chats for this designer
  const { data: pinned } = await supabaseAdmin
    .from("pinned_chats")
    .select("track_id")
    .eq("user_id", portalUser.user_id);

  // Get track stages to check which have sample requested
  const { data: trackStages } = await supabaseAdmin
    .from("plm_track_stages")
    .select("track_id, stage, status")
    .in("track_id", trackIds)
    .eq("stage", "sample_requested")
    .eq("status", "done");

  const sampleRequestedTrackIds = new Set((trackStages || []).map((s: any) => s.track_id));

  const chats = tracks
    .filter((t: any) => memberTrackIds.has(t.id) && sampleRequestedTrackIds.has(t.id))
    .map((t: any) => {
      const trackMsgs = (messages || []).filter((m: any) => m.track_id === t.id);
      const latest = trackMsgs[0];
      const unread = trackMsgs.filter((m: any) => m.sender_role !== "designer" && !m.read_by_designer).length;
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
    });

  return NextResponse.json({ chats, pinned: pinned || [] });
}

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, track_id } = body;

  if (action === "get_messages") {
    const { data } = await supabaseAdmin.from("track_messages")
      .select("*").eq("track_id", track_id).order("created_at", { ascending: true });
    // Mark all non-designer messages as read
    await supabaseAdmin.from("track_messages")
      .update({ read_by_designer: true })
      .eq("track_id", track_id)
      .neq("sender_role", "designer")
      .eq("read_by_designer", false);
    return NextResponse.json({ messages: data || [] });
  }

  if (action === "send_message") {
    const { message, product_id, attachment_url, attachment_type, attachment_name } = body;
    await supabaseAdmin.from("track_messages").insert({
      track_id, product_id, user_id: null,
      sender_role: "designer",
      sender_name: portalUser.name || portalUser.email || "Designer",
      message: message || "",
      attachment_url: attachment_url || null,
      attachment_type: attachment_type || null,
      attachment_name: attachment_name || null,
    });
    // Notify admin
    try {
      const { data: trackInfo } = await supabaseAdmin.from("plm_factory_tracks")
        .select("user_id, plm_products(name)").eq("id", track_id).single();
      if (trackInfo) {
        const productName = (trackInfo as any).plm_products?.name || "Product";
        await createNotification({
          user_id: (trackInfo as any).user_id,
          type: "message",
          title: "New message — " + productName,
          body: (portalUser.name || "Designer") + ": " + (message || "Attachment"),
          link: "/messages"
        });
      }
    } catch {}
    return NextResponse.json({ success: true });
  }

  if (action === "pin") {
    await supabaseAdmin.from("pinned_chats").upsert({ user_id: portalUser.id, track_id });
    return NextResponse.json({ success: true });
  }

  if (action === "unpin") {
    await supabaseAdmin.from("pinned_chats").delete().eq("user_id", portalUser.id).eq("track_id", track_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
