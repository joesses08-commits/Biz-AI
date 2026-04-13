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
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("is_designer, admin_user_id").eq("id", user.id).single();
  if (profile?.is_designer && profile?.admin_user_id) {
    return { ...user, id: profile.admin_user_id, _is_designer: true, _designer_id: user.id };
  }
  return user;
}

const STAGE_ORDER = [
  "artwork_sent",
  "quote_requested",
  "quote_received",
  "sample_requested",
  "sample_production",
  "sample_complete",
  "sample_shipped",
  "sample_arrived",
  "sample_reviewed",
];

const STAGE_LABELS: Record<string, string> = {
  artwork_sent: "Artwork Sent",
  quote_requested: "Quote Requested",
  quote_received: "Quote Received",
  sample_requested: "Sample Requested",
  sample_production: "Sample Production",
  sample_complete: "Sample Complete",
  sample_shipped: "Sample Shipped",
  sample_arrived: "Sample Arrived",
  sample_reviewed: "Sample Reviewed",
  revision_requested: "Revision Requested",
};

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const product_id = req.nextUrl.searchParams.get("product_id");
  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { data: tracks, error } = await supabaseAdmin
    .from("plm_factory_tracks")
    .select("*, factory_catalog(id, name, email, contact_name), plm_track_stages(*)")
    .eq("product_id", product_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (tracks || []).map((track: any) => ({
    ...track,
    plm_track_stages: (track.plm_track_stages || []).sort((a: any, b: any) =>
      STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
    ),
  }));

  return NextResponse.json({ tracks: enriched });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "create_track") {
    const { product_id, factory_id } = body;

    const { data: existing } = await supabaseAdmin
      .from("plm_factory_tracks")
      .select("id")
      .eq("product_id", product_id)
      .eq("factory_id", factory_id)
      .single();

    if (existing) return NextResponse.json({ error: "Track already exists for this factory" }, { status: 400 });

    const { data: track, error } = await supabaseAdmin
      .from("plm_factory_tracks")
      .insert({ user_id: user.id, product_id, factory_id, status: "active" })
      .select("*, factory_catalog(id, name, email)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, track });
  }

  if (action === "update_stage") {
    const { track_id, product_id, factory_id, stage, status, notes, skip_reason, expected_date, actual_date, quoted_price, revision_number } = body;

    const { data: existing } = await supabaseAdmin
      .from("plm_track_stages")
      .select("id")
      .eq("track_id", track_id)
      .eq("stage", stage)
      .eq("revision_number", revision_number || 0)
      .single();

    let stageData: any;
    if (existing) {
      const { data } = await supabaseAdmin
        .from("plm_track_stages")
        .update({
          status,
          notes: notes || null,
          skip_reason: skip_reason || null,
          expected_date: expected_date || null,
          actual_date: actual_date || null,
          quoted_price: quoted_price || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      stageData = data;
    } else {
      const { data } = await supabaseAdmin
        .from("plm_track_stages")
        .insert({
          track_id,
          product_id,
          factory_id,
          stage,
          status,
          notes: notes || null,
          skip_reason: skip_reason || null,
          expected_date: expected_date || null,
          actual_date: actual_date || null,
          quoted_price: quoted_price || null,
          revision_number: revision_number || 0,
          updated_by: "admin",
        })
        .select()
        .single();
      stageData = data;
    }

    return NextResponse.json({ success: true, stage: stageData });
  }

  if (action === "approve_track") {
    const { track_id, product_id, factory_id, approved_price, revision_number } = body;

    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id,
      factory_id,
      stage: "sample_reviewed",
      status: "done",
      notes: `Approved${approved_price ? ` at $${approved_price}` : ""}`,
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revision_number || 0,
      updated_by: "admin",
    });

    await supabaseAdmin
      .from("plm_factory_tracks")
      .update({
        status: "approved",
        approved_price: approved_price || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", track_id)
      .eq("user_id", user.id);

    await supabaseAdmin
      .from("plm_products")
      .update({ current_stage: "sample_approved", updated_at: new Date().toISOString() })
      .eq("id", product_id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  }

  if (action === "request_revision") {
    const { track_id, product_id, factory_id, revision_number, notes } = body;

    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id,
      factory_id,
      stage: "revision_requested",
      status: "done",
      notes: notes || "Revision requested",
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revision_number || 0,
      updated_by: "admin",
    });

    await supabaseAdmin
      .from("plm_factory_tracks")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", track_id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  }

  if (action === "kill_track") {
    const { track_id, product_id, factory_id, notes, kill_product, revision_number } = body;

    await supabaseAdmin.from("plm_track_stages").insert({
      track_id,
      product_id,
      factory_id,
      stage: "sample_reviewed",
      status: "done",
      notes: notes || "Factory discontinued",
      actual_date: new Date().toISOString().split("T")[0],
      revision_number: revision_number || 0,
      updated_by: "admin",
    });

    await supabaseAdmin
      .from("plm_factory_tracks")
      .update({ status: "killed", updated_at: new Date().toISOString() })
      .eq("id", track_id)
      .eq("user_id", user.id);

    if (kill_product) {
      await supabaseAdmin
        .from("plm_products")
        .update({ killed: true, status: "killed", updated_at: new Date().toISOString() })
        .eq("id", product_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete_track") {
    const { track_id } = body;
    await supabaseAdmin.from("plm_track_stages").delete().eq("track_id", track_id);
    await supabaseAdmin.from("plm_factory_tracks").delete().eq("id", track_id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  if (action === "update_track_notes") {
    const { track_id, notes } = body;
    await supabaseAdmin.from("plm_factory_tracks").update({ notes, updated_at: new Date().toISOString() }).eq("id", track_id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
