import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

function extractExcelText(base64: string): string {
  const buffer = Buffer.from(base64, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  let text = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    text += `\n[Sheet: ${sheetName}]\n` + XLSX.utils.sheet_to_csv(sheet);
  }
  return text.slice(0, 8000);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { file_base64, file_name, file_type, action } = body;

  // ── STEP 1: IDENTIFY — what is this document?
  if (action === "identify") {
    // Fetch context for identification
    const [{ data: products }, { data: factories }, { data: rfqJobs }] = await Promise.all([
      supabaseAdmin.from("plm_products").select("id, name, sku").eq("user_id", user.id).eq("killed", false),
      supabaseAdmin.from("factory_catalog").select("id, name, email").eq("user_id", user.id),
      supabaseAdmin.from("factory_quote_jobs").select("id, job_name, status, factories").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    let fileContent = "";
    if (file_type?.includes("sheet") || file_name?.match(/\.xlsx?$/i)) {
      fileContent = extractExcelText(file_base64);
    } else {
      fileContent = Buffer.from(file_base64, "base64").toString("utf-8").slice(0, 6000);
    }

    const productList = (products || []).map((p: any) => `${p.name} (${p.sku})`).join(", ");
    const factoryList = (factories || []).map((f: any) => `${f.name} (${f.email || "no email"})`).join(", ");
    const rfqList = (rfqJobs || []).map((j: any) => `${j.job_name} [${j.id}]`).join(", ");

    const prompt = `You are analyzing a business document dropped into a wholesale PLM system. Identify what type of document this is and extract key information.

Known products: ${productList}
Known factories: ${factoryList}
Recent RFQ jobs: ${rfqList}

Document filename: ${file_name}
Document content:
${fileContent}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "doc_type": "factory_quote" | "purchase_order" | "sample_feedback" | "product_import" | "unknown",
  "confidence": "high" | "medium" | "low",
  "factory_name": "name if detected, or null",
  "factory_id": "matched factory ID from known factories list if matched, or null",
  "summary": "one sentence describing what this document is",
  "confirmation_message": "friendly message asking user to confirm, e.g. 'This looks like a quote from Fred Factory for 5 products — add to quote comparison and mark quotes received?'",
  "extracted_data": {
    "products": [{"name": "", "sku": "", "price": null, "moq": null, "lead_time": ""}],
    "order_qty": null,
    "order_price": null,
    "collection_name": null,
    "feedback_notes": null
  },
  "rfq_job_id": "matching RFQ job ID if this is a quote response, or null"
}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    await trackUsage(user.id, "document_drop_identify", "claude-haiku-4-5-20251001",
      response.usage.input_tokens, response.usage.output_tokens);

    const raw = (response.content[0] as any).text || "";
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(first, last + 1));

    return NextResponse.json({ success: true, identified: parsed });
  }

  // ── STEP 2: EXECUTE — wire it into PLM
  if (action === "execute") {
    const { doc_type, factory_id, factory_name, rfq_job_id, extracted_data } = body;

    // ── FACTORY QUOTE
    if (doc_type === "factory_quote") {
      const products_extracted = extracted_data?.products || [];
      const [{ data: allProducts }, { data: allTracks }] = await Promise.all([
        supabaseAdmin.from("plm_products").select("id, name, sku").eq("user_id", user.id).eq("killed", false),
        supabaseAdmin.from("plm_factory_tracks").select("id, product_id, factory_id, plm_track_stages(id, stage, status, revision_number)").eq("user_id", user.id).eq("factory_id", factory_id || ""),
      ]);

      const today = new Date().toISOString().split("T")[0];
      let updated = 0;

      for (const ep of products_extracted) {
        // Match to known product
        const matched = (allProducts || []).find((p: any) =>
          p.name?.toLowerCase().includes(ep.name?.toLowerCase()) ||
          p.sku?.toLowerCase() === ep.sku?.toLowerCase()
        );
        if (!matched) continue;

        // Find track for this factory
        let track = (allTracks || []).find((t: any) => t.product_id === matched.id);

        // Auto-create track if missing
        if (!track && factory_id) {
          const { data: newTrack } = await supabaseAdmin.from("plm_factory_tracks")
            .insert({ user_id: user.id, product_id: matched.id, factory_id, status: "active" })
            .select("id, product_id, factory_id, plm_track_stages(id, stage, status, revision_number)")
            .single();
          if (newTrack) track = newTrack as any;
        }
        if (!track) continue;

        const stages = (track as any).plm_track_stages || [];
        const revNum = stages.filter((s: any) => s.stage === "revision_requested").length;

        // Mark quote_received done with price
        const existing = stages.find((s: any) => s.stage === "quote_received");
        if (existing) {
          await supabaseAdmin.from("plm_track_stages").update({
            status: "done", actual_date: today,
            quoted_price: ep.price || null,
            notes: `Quote received from ${factory_name || "factory"} via document drop`,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("plm_track_stages").insert({
            track_id: track.id, product_id: matched.id, factory_id,
            stage: "quote_received", status: "done", actual_date: today,
            quoted_price: ep.price || null,
            notes: `Quote received from ${factory_name || "factory"} via document drop`,
            revision_number: revNum, updated_by: "jimmy_ai",
          });
        }

        // Also mark artwork_sent + quote_requested if not done
        for (const stageKey of ["artwork_sent", "quote_requested"]) {
          const s = stages.find((st: any) => st.stage === stageKey);
          if (!s) {
            await supabaseAdmin.from("plm_track_stages").insert({
              track_id: track.id, product_id: matched.id, factory_id,
              stage: stageKey, status: "done", actual_date: today,
              notes: `Auto-marked via document drop`, revision_number: revNum, updated_by: "jimmy_ai",
            });
          }
        }
        updated++;
      }

      // Add to RFQ job if matched
      if (rfq_job_id) {
        await supabaseAdmin.from("factory_quotes").insert({
          job_id: rfq_job_id, factory_name: factory_name || "Unknown",
          factory_email: null, status: "processed",
          processed_data: products_extracted,
          raw_data: { source: "document_drop", file_name },
        });
      }

      return NextResponse.json({ success: true, message: `Updated ${updated} products with quote data from ${factory_name}` });
    }

    // ── PURCHASE ORDER
    if (doc_type === "purchase_order") {
      const { order_qty, order_price, products: poProducts } = extracted_data || {};
      const [{ data: allProducts }, { data: allFactories }] = await Promise.all([
        supabaseAdmin.from("plm_products").select("id, name, sku").eq("user_id", user.id).eq("killed", false),
        supabaseAdmin.from("factory_catalog").select("id, name").eq("user_id", user.id),
      ]);

      let created = 0;
      for (const ep of (poProducts || [])) {
        const matched = (allProducts || []).find((p: any) =>
          p.name?.toLowerCase().includes(ep.name?.toLowerCase()) ||
          p.sku?.toLowerCase() === ep.sku?.toLowerCase()
        );
        if (!matched) continue;

        const fId = factory_id || (allFactories || []).find((f: any) =>
          f.name?.toLowerCase().includes(factory_name?.toLowerCase())
        )?.id;

        const { data: existing } = await supabaseAdmin.from("plm_batches")
          .select("batch_number").eq("product_id", matched.id)
          .order("batch_number", { ascending: false }).limit(1);
        const batchNum = ((existing?.[0] as any)?.batch_number || 0) + 1;

        await supabaseAdmin.from("plm_batches").insert({
          user_id: user.id, product_id: matched.id, factory_id: fId || null,
          batch_number: batchNum, current_stage: "po_issued",
          order_quantity: ep.moq || order_qty || null,
          unit_price: ep.price || order_price || null,
          notes: `PO created via document drop — ${file_name}`,
        });
        created++;
      }

      return NextResponse.json({ success: true, message: `Created ${created} production orders from PO` });
    }

    // ── SAMPLE FEEDBACK
    if (doc_type === "sample_feedback") {
      const { products: feedbackProducts, feedback_notes } = extracted_data || {};
      const { data: allProducts } = await supabaseAdmin.from("plm_products")
        .select("id, name, sku, notes").eq("user_id", user.id).eq("killed", false);

      let updated = 0;
      for (const ep of (feedbackProducts || [])) {
        const matched = (allProducts || []).find((p: any) =>
          p.name?.toLowerCase().includes(ep.name?.toLowerCase()) ||
          p.sku?.toLowerCase() === ep.sku?.toLowerCase()
        );
        if (!matched) continue;

        const note = `Sample feedback from ${factory_name || "factory"} (${new Date().toLocaleDateString()}): ${ep.feedback_notes || feedback_notes || "See attached document"}`;
        const updatedNotes = matched.notes ? `${matched.notes}\n${note}` : note;
        await supabaseAdmin.from("plm_products").update({ notes: updatedNotes, updated_at: new Date().toISOString() }).eq("id", matched.id);
        updated++;
      }

      return NextResponse.json({ success: true, message: `Added feedback notes to ${updated} products` });
    }

    // ── PRODUCT IMPORT
    if (doc_type === "product_import") {
      const { products: importProducts, collection_name } = extracted_data || {};

      // Create collection if named
      let collectionId = null;
      if (collection_name) {
        const { data: existing } = await supabaseAdmin.from("plm_collections")
          .select("id").eq("user_id", user.id).ilike("name", collection_name).single();
        if (existing) {
          collectionId = existing.id;
        } else {
          const { data: newCol } = await supabaseAdmin.from("plm_collections")
            .insert({ user_id: user.id, name: collection_name }).select("id").single();
          collectionId = newCol?.id;
        }
      }

      let created = 0;
      for (const ep of (importProducts || [])) {
        if (!ep.name) continue;
        await supabaseAdmin.from("plm_products").insert({
          user_id: user.id,
          name: ep.name,
          sku: ep.sku || null,
          description: ep.description || null,
          specs: ep.specs || null,
          collection_id: collectionId,
          status: "concept",
          killed: false,
        });
        created++;
      }

      return NextResponse.json({ success: true, message: `Created ${created} products${collection_name ? ` in "${collection_name}"` : ""}` });
    }

    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
