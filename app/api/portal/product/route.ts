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

  const url = new URL(req.url);
  const productId = url.searchParams.get("id");
  if (!productId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Get full product details
  const { data: product } = await supabaseAdmin
    .from("plm_products")
    .select("*, plm_collections(name, season, year), plm_batches(*, plm_batch_stages(*))")
    .eq("id", productId)
    .eq("user_id", portalUser.user_id)
    .single();

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Filter batches and sample requests to only this factory
  const factoryBatches = (product.plm_batches || []).filter(
    (b: any) => b.factory_id === portalUser.factory_id
  );

  // Get sample requests for this factory
  const { data: sampleRequests } = await supabaseAdmin
    .from("plm_sample_requests")
    .select("*, plm_sample_stages(*)")
    .eq("product_id", productId)
    .eq("factory_id", portalUser.factory_id)
    .order("created_at", { ascending: true });

  // Check if this factory's track is disqualified
  const { data: factoryTrack } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("id, status, disqualify_reason, disqualified_at")
    .eq("product_id", productId)
    .eq("factory_id", portalUser.factory_id)
    .single();

  const isDisqualified = factoryTrack?.status === "killed" && factoryTrack?.disqualified_at;
  // Hide from portal after 3 days
  const disqualifiedAt = factoryTrack?.disqualified_at ? new Date(factoryTrack.disqualified_at) : null;
  const hideFromPortal = disqualifiedAt && (Date.now() - disqualifiedAt.getTime()) > 3 * 24 * 60 * 60 * 1000;

  // Handle POST actions for messages
  if (req.method === "POST") {
    const body = await req.json();
    const { action, track_id, message } = body;
    if (action === "get_messages") {
      const { data } = await supabaseAdmin.from("track_messages")
        .select("*").eq("track_id", track_id).order("created_at", { ascending: true });
      return NextResponse.json({ messages: data || [] });
    }
    if (action === "send_message") {
      await supabaseAdmin.from("track_messages").insert({
        track_id, product_id: productId, user_id: portalUser.user_id,
        sender_role: "factory", sender_name: portalUser.name || portalUser.email || "Factory", message,
      });
      return NextResponse.json({ success: true });
    }
  }

  return NextResponse.json({ 
    product: { 
      ...product, 
      plm_batches: factoryBatches,
      plm_sample_requests: sampleRequests || [],
      track_id: factoryTrack?.id || null,
      is_disqualified: isDisqualified,
    } 
  });
}
