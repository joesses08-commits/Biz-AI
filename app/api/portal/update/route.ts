import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notify";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAMPLE_STAGES = ["sample_production", "sample_complete", "sample_shipped"];
const PRODUCTION_STAGES = ["production_started", "production_complete", "qc_inspection", "ready_to_ship", "shipped"];
const ALL_ALLOWED = [...SAMPLE_STAGES, ...PRODUCTION_STAGES];

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

export async function POST(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, batch_id, sample_request_id, stage, notes } = await req.json();

  if (!ALL_ALLOWED.includes(stage)) {
    return NextResponse.json({ error: "Stage not allowed" }, { status: 403 });
  }

  if (SAMPLE_STAGES.includes(stage)) {
    // Write directly to plm_factory_tracks + plm_track_stages (new system)
    // Set action_status based on stage
    const actionStatus = (stage === "sample_arrived" || stage === "sample_shipped") ? "action_required" : "updates_made";
    await supabaseAdmin.from("plm_products").update({
      action_status: actionStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", product_id).eq("user_id", portalUser.user_id);

    // Write to plm_factory_tracks + plm_track_stages
    const { data: track } = await supabaseAdmin
      .from("plm_factory_tracks")
      .select("id")
      .eq("product_id", product_id)
      .eq("factory_id", portalUser.factory_id)
      .single();

    if (track) {
      // Get current revision number
      const { data: revStages } = await supabaseAdmin
        .from("plm_track_stages")
        .select("id")
        .eq("track_id", track.id)
        .eq("stage", "revision_requested");
      const revNum = (revStages || []).length;

      // Upsert the stage into plm_track_stages
      const { data: existingStage } = await supabaseAdmin
        .from("plm_track_stages")
        .select("id")
        .eq("track_id", track.id)
        .eq("stage", stage)
        .eq("revision_number", revNum)
        .single();

      if (existingStage) {
        await supabaseAdmin.from("plm_track_stages").update({
          status: "done",
          actual_date: new Date().toISOString().split("T")[0],
          notes: notes || null,
          updated_by: "factory",
          updated_at: new Date().toISOString(),
        }).eq("id", existingStage.id);
      } else {
        await supabaseAdmin.from("plm_track_stages").insert({
          track_id: track.id,
          product_id,
          factory_id: portalUser.factory_id,
          stage,
          status: "done",
          actual_date: new Date().toISOString().split("T")[0],
          notes: notes || null,
          revision_number: revNum,
          updated_by: "factory",
        });
      }
    }

  } else {
    // Production stage — update the specific order (batch)
    if (!batch_id) return NextResponse.json({ error: "batch_id required for production stages" }, { status: 400 });

    const { data: batch } = await supabaseAdmin
      .from("plm_batches")
      .select("id, product_id, user_id")
      .eq("id", batch_id)
      .eq("factory_id", portalUser.factory_id)
      .single();

    if (!batch) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const updateData: any = {
      current_stage: stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("plm_batches").update(updateData).eq("id", batch_id);

    // Save note to product factory_notes if provided
    if (notes) {
      await supabaseAdmin.from("plm_products").update({
        factory_notes: notes,
        updated_at: new Date().toISOString(),
      }).eq("id", batch.product_id).eq("user_id", batch.user_id);
    }

    // Production update = updates_made (ball still in factory court)
    await supabaseAdmin.from("plm_products").update({
      action_status: "updates_made",
      updated_at: new Date().toISOString(),
    }).eq("id", batch.product_id).eq("user_id", batch.user_id);

    await supabaseAdmin.from("plm_batch_stages").insert({
      batch_id,
      product_id: batch.product_id,
      user_id: batch.user_id,
      stage,
      notes: notes || "",
      updated_by: portalUser.email,
      updated_by_role: "factory",
    });
    // Notify admin
    try {
      const { data: product } = await supabaseAdmin.from("plm_products").select("name").eq("id", batch.product_id).single();
      const stageLabel = stage.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      await createNotification({
        user_id: batch.user_id,
        type: "stage_update",
        title: stageLabel + " — " + (product?.name || "Product"),
        body: (portalUser.name || portalUser.email || "Factory") + " marked " + stageLabel.toLowerCase(),
        link: "/plm/" + batch.product_id
      });
    } catch {}
  }

  return NextResponse.json({ success: true });
}
