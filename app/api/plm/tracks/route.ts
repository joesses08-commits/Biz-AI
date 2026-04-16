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

  // ── DISQUALIFY TRACK
  if (action === "disqualify_track") {
    const { track_id, reason, note, product_name, factory_name, factory_email, contact_name } = body;

    // Get user profile for sign-off
    const { data: profile } = await supabaseAdmin.from("profiles")
      .select("full_name, company_name").eq("id", user.id).single();
    const { data: companyProfile } = await supabaseAdmin.from("company_profiles")
      .select("company_name").eq("user_id", user.id).single();
    const senderName = profile?.full_name || user.email?.split("@")[0] || "The Team";
    const companyName = companyProfile?.company_name || profile?.company_name || "Our Company";

    // Get existing track notes
    const { data: existingTrack } = await supabaseAdmin.from("plm_factory_tracks")
      .select("notes").eq("id", track_id).single();
    const existingNotes = existingTrack?.notes || "";
    const disqualifyEntry = `[Disqualified - ${new Date().toLocaleDateString()} - ${reason}]${note ? `\n${note}` : ""}`;
    const updatedNotes = existingNotes ? `${existingNotes}\n\n${disqualifyEntry}` : disqualifyEntry;

    await supabaseAdmin.from("plm_factory_tracks").update({
      status: "killed",
      disqualify_reason: reason,
      disqualify_note: note || null,
      disqualified_at: new Date().toISOString(),
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    }).eq("id", track_id).eq("user_id", user.id);

    if (factory_email) {
      const reasonText = reason === "price" ? "pricing was not competitive for this order"
        : reason === "speed" ? "lead times were not able to meet our timeline requirements"
        : "quality of samples did not meet our specifications";
      const emailBody = `Hi ${contact_name || factory_name},

Thank you for your time and effort on the ${product_name} sample. We truly appreciate the work you put in.

After careful consideration, we have decided to move forward with another supplier for this particular product, as their ${reasonText}.${note ? `

${note}` : ""}

Please disregard any further sample production for this item. We hope to work together on future opportunities and will keep you in mind for upcoming projects.

Thank you again for your partnership.

Best regards,
${senderName}
${companyName}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "onboarding@resend.dev", to: factory_email, subject: `Update on ${product_name} Sample`, text: emailBody }),
      });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

