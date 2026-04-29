import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { trackUsage } from "@/lib/track-usage";

async function extractExcelImages(base64: string): Promise<Buffer[]> {
  try {
    const buffer = Buffer.from(base64, "base64");
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files)
      .filter(f => f.startsWith("xl/media/") && !zip.files[f].dir)
      .sort();
    const images: Buffer[] = [];
    for (const f of mediaFiles) {
      const data = await zip.files[f].async("nodebuffer");
      images.push(data);
    }
    return images;
  } catch { return []; }
}

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
  const { file_base64, file_name, file_type, action, user_hint } = body;

  // ── STEP 1: IDENTIFY — what is this document?
  if (action === "identify") {
    try {
    // Fetch context for identification
    const [{ data: products }, { data: factories }, { data: rfqJobs }] = await Promise.all([
      supabaseAdmin.from("plm_products").select("id, name, sku").eq("user_id", user.id).eq("killed", false),
      supabaseAdmin.from("factory_catalog").select("id, name, email").eq("user_id", user.id),
      supabaseAdmin.from("factory_quote_jobs").select("id, job_name, status, factories").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    let fileContent = "";
    if (file_type?.includes("sheet") || file_name?.match(/\.xlsx?$/i)) {
      fileContent = extractExcelText(file_base64).slice(0, 5000);
    } else if (file_type?.includes("pdf") || file_name?.match(/\.pdf$/i)) {
      try {
        const visionRes = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: file_base64 } } as any,
            { type: "text", text: "Extract all text content from this document. Return everything you can read including all fields, values, numbers, and labels." }
          ]}],
        });
        fileContent = visionRes.content[0].type === "text" ? visionRes.content[0].text : "Could not extract PDF content";
      } catch {
        fileContent = "PDF could not be parsed";
      }
    } else {
      fileContent = Buffer.from(file_base64, "base64").toString("utf-8").slice(0, 6000);
    }

    const productList = (products || []).map((p: any) => `${p.name} (${p.sku})`).join(", ");
    const factoryList = (factories || []).map((f: any) => `${f.name} [id:${f.id}]`).join(", ");
    const rfqList = (rfqJobs || []).map((j: any) => `${j.job_name} [${j.id}]`).join(", ");

    const prompt = `You are analyzing a business document dropped into a wholesale PLM system. Identify what type of document this is and extract key information.

Known products: ${productList}
Known factories: ${factoryList}
Recent RFQ jobs: ${rfqList}

Document filename: ${file_name}
${user_hint ? `User hint: "${user_hint}"` : ""}
Document content:
${fileContent}

IMPORTANT: unit_price must always be price PER UNIT not the line total. If you see a total and a quantity, divide total by quantity.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "doc_type": "factory_quote" | "purchase_order" | "sample_feedback" | "product_import" | "unknown",
  "confidence": "high" | "medium" | "low",
  "factory_name": "name if detected, or null",
  "factory_id": "MUST be the exact id from the known factories list above (e.g. the part after id:). Match the closest factory name. Never return null if any factory is known.",
  "summary": "one sentence describing what this document is",
  "confirmation_message": "friendly message asking user to confirm, e.g. 'This looks like a quote from Fred Factory for 5 products — add to quote comparison and mark quotes received?'",
  "extracted_data": {
    "products": [{"name": "", "sku": "", "unit_price": null, "quantity": null, "moq": null, "lead_time": "", "description": "", "specs": "", "category": "", "collection": "", "notes": "", "feedback": ""}],
    "po_number": "PO number if found or null",
    "payment_terms": "payment terms if found or null",
    "order_qty": null,
    "order_price": null,
    "collection_name": "collection name if product import sheet, or null",
    "feedback_notes": null
  },
  "rfq_job_id": "matching RFQ job ID if this is a quote response, or null"
}

For product_import: extract ALL available fields per product including description, specs, category, notes. Extract collection name from sheet header or title row.`;

    const isPdf = file_type?.includes("pdf") || file_name?.match(/\.pdf$/i);
    const messageContent: any[] = isPdf
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: file_base64 } } as any,
          { type: "text", text: prompt }
        ]
      : [{ type: "text", text: prompt }];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: messageContent }],
    });

    await trackUsage(user.id, "document_drop_identify", "claude-haiku-4-5-20251001",
      response.usage.input_tokens, response.usage.output_tokens);

    const raw = (response.content[0] as any).text || "";
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    let parsed;
    try {
      parsed = JSON.parse(raw.slice(first, last + 1));
    } catch (e) {
      console.error("Raw AI response:", raw.slice(0, 500));
      return NextResponse.json({ error: "Could not identify this document. Try again." }, { status: 400 });
    }

    return NextResponse.json({ success: true, identified: parsed });
    } catch (err: any) {
      console.error("Document drop identify error:", err?.message || err);
      return NextResponse.json({ error: "Failed to process document: " + (err?.message || "Unknown error") }, { status: 500 });
    }
  }

  // ── STEP 2: EXECUTE — wire it into PLM
  if (action === "execute") {
    const { doc_type, factory_name, rfq_job_id, extracted_data, file_name, file_base64 } = body;
    let { factory_id } = body;

    // ── FACTORY QUOTE
    if (doc_type === "factory_quote") {
      const products_extracted = extracted_data?.products || [];

      // Resolve factory_id by name if not provided
      if (!factory_id && factory_name) {
        const { data: fMatch } = await supabaseAdmin.from("factory_catalog")
          .select("id").eq("user_id", user.id)
          .ilike("name", `%${factory_name}%`).single();
        if (fMatch) factory_id = fMatch.id;
      }

      const [{ data: allProducts }, { data: allTracks }] = await Promise.all([
        supabaseAdmin.from("plm_products").select("id, name, sku").eq("user_id", user.id).eq("killed", false),
        factory_id
          ? supabaseAdmin.from("plm_factory_tracks").select("id, product_id, factory_id, plm_track_stages(id, stage, status, revision_number)").eq("user_id", user.id).eq("factory_id", factory_id)
          : Promise.resolve({ data: [] }),
      ]);

      const today = new Date().toISOString().split("T")[0];
      let updated = 0;

      console.log("factory_id resolved:", factory_id);
      console.log("products_extracted:", JSON.stringify(products_extracted?.slice(0,3)));
      console.log("allProducts:", JSON.stringify((allProducts || []).slice(0,3)));

      for (const ep of products_extracted) {
        // Match to known product — SKU first, then name
        const epSku = ep.sku?.trim().toLowerCase();
        const epName = ep.name?.trim().toLowerCase();
        const matched = (allProducts || []).find((p: any) =>
          (epSku && p.sku?.trim().toLowerCase() === epSku) ||
          (epName && p.name?.trim().toLowerCase().includes(epName)) ||
          (epName && epName.includes(p.name?.trim().toLowerCase()))
        );
        console.log(`Matching ep: ${ep.name} (${ep.sku}) -> matched: ${matched?.name}`);
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

        // Build factory note from all extracted data and save to track
        const noteLines = [`Quote from ${factory_name || "factory"} (${new Date().toLocaleDateString()}):`];
        if (ep.unit_price || ep.price) noteLines.push(`  Price: $${ep.unit_price || ep.price}`);
        if (ep.moq) noteLines.push(`  MOQ: ${ep.moq}`);
        if (ep.lead_time) noteLines.push(`  Lead time: ${ep.lead_time}`);
        if (ep.sample_lead_time) noteLines.push(`  Sample lead: ${ep.sample_lead_time}`);
        if (ep.payment_terms) noteLines.push(`  Payment: ${ep.payment_terms}`);
        const factoryNote = noteLines.join("\n");
        const existingTrackNotes = (track as any).notes || "";
        await supabaseAdmin.from("plm_factory_tracks").update({
          notes: existingTrackNotes ? `${existingTrackNotes}\n${factoryNote}` : factoryNote,
          updated_at: new Date().toISOString()
        }).eq("id", (track as any).id);

        const stages = (track as any).plm_track_stages || [];
        const revNum = stages.filter((s: any) => s.stage === "revision_requested").length;

        // Mark quote_received done with price
        const existing = stages.find((s: any) => s.stage === "quote_received");
        if (existing) {
          await supabaseAdmin.from("plm_track_stages").update({
            status: "done", actual_date: today,
            quoted_price: ep.unit_price || ep.price || null,
            notes: `Quote received from ${factory_name || "factory"} via document drop`,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("plm_track_stages").insert({
            track_id: track.id, product_id: matched.id, factory_id,
            stage: "quote_received", status: "done", actual_date: today,
            quoted_price: ep.unit_price || ep.price || null,
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

      // Match to RFQ job by comparing extracted SKUs against job product lists
      let jobId = rfq_job_id;
      if (!jobId) {
        const { data: recentJobs } = await supabaseAdmin.from("factory_quote_jobs")
          .select("id, order_details, factories")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentJobs?.length) {
          // Get SKUs from this quote
          const quotedSkus = new Set(products_extracted.map((p: any) => p.sku?.trim().toLowerCase()).filter(Boolean));

          // Get all products to map IDs to SKUs (fallback if job doesn't have skus stored)
          const { data: allProds } = await supabaseAdmin.from("plm_products")
            .select("id, sku").eq("user_id", user.id);
          const prodSkuMap = Object.fromEntries((allProds || []).map((p: any) => [p.id, p.sku?.trim().toLowerCase()]));

          let bestMatch = null;
          let bestScore = 0;

          for (const job of recentJobs) {
            const orderDetails = job.order_details as any;
            // Use stored SKUs if available, otherwise derive from product IDs
            const jobSkuList = orderDetails?.product_skus?.length
              ? orderDetails.product_skus.map((s: string) => s?.trim().toLowerCase())
              : (orderDetails?.plm_product_ids || []).map((id: string) => prodSkuMap[id]).filter(Boolean);
            const jobSkus = new Set(jobSkuList);

            // Also check factory match bonus
            const jobFactories = (job.factories || []).map((f: any) => f.name?.toLowerCase());
            const factoryMatch = factory_name && jobFactories.some((fn: string) =>
              fn && (fn.includes(factory_name.toLowerCase()) || factory_name.toLowerCase().includes(fn))
            );

            let overlap = 0;
            quotedSkus.forEach((sku: any) => { if (jobSkus.has(sku)) overlap++; });
            const skuScore = jobSkus.size > 0 ? overlap / jobSkus.size : 0;
            // Boost score if factory also matches
            const score = skuScore + (factoryMatch ? 0.2 : 0);

            console.log(`Job ${job.id} SKU score: ${skuScore} factory match: ${factoryMatch} total: ${score}`);
            if (score > bestScore) { bestScore = score; bestMatch = job; }
          }

          if (bestMatch && bestScore > 0.2) {
            jobId = bestMatch.id;
            console.log(`Matched to RFQ job ${jobId} with score ${bestScore}`);
          }
        }
      }
      if (jobId) {
        // Get the job to find the exact factory name from the job's factory list
        const { data: theJob } = await supabaseAdmin.from("factory_quote_jobs")
          .select("factories").eq("id", jobId).single();
        const jobFactories = (theJob as any)?.factories || [];
        // Find best matching factory name from job
        const matchedJobFactory = jobFactories.find((f: any) =>
          f.name?.toLowerCase().includes((factory_name || "").toLowerCase()) ||
          (factory_name || "").toLowerCase().includes(f.name?.toLowerCase())
        );
        const saveFactoryName = matchedJobFactory?.name || factory_name || "Unknown";
        const saveFactoryEmail = matchedJobFactory?.email || null;

        // Check if quote already exists for this factory
        const { data: allJobQuotes } = await supabaseAdmin.from("factory_quotes")
          .select("id, factory_name").eq("job_id", jobId);
        const existingQuote = (allJobQuotes || []).find((q: any) =>
          q.factory_name?.toLowerCase() === saveFactoryName.toLowerCase() ||
          q.factory_name?.toLowerCase().includes((factory_name || "").toLowerCase()) ||
          (factory_name || "").toLowerCase().includes(q.factory_name?.toLowerCase())
        );

        // Fetch job order details to calculate ELC
        const { data: jobForElc } = await supabaseAdmin.from("factory_quote_jobs").select("order_details").eq("id", jobId).single();
        const elcOrderDetails = (jobForElc?.order_details as any) || {};
        const elcDutyPct = parseFloat(elcOrderDetails.duty_pct || "30") / 100;
        const elcTariffPct = parseFloat(elcOrderDetails.tariff_pct || "20") / 100;
        const elcFreight = parseFloat(elcOrderDetails.freight || "0.15");
        const processedExtracted = (products_extracted || []).map((p: any) => {
          const firstCost = parseFloat(p.unit_price || p.unit_cost || p.first_cost || "0") || 0;
          const elc = firstCost * (1 + elcDutyPct) * (1 + elcTariffPct) + elcFreight;
          return {
            ...p,
            factory_name: saveFactoryName,
            factory_email: saveFactoryEmail || "",
            first_cost: firstCost,
            unit_cost: firstCost,
            duty_pct: elcOrderDetails.duty_pct || "30",
            tariff_pct: elcOrderDetails.tariff_pct || "20",
            freight: elcFreight,
            elc: Math.round(elc * 100) / 100,
            product_name: p.name || p.product_name || "",
            lead_time_days: parseInt(p.lead_time || p.lead_time_days || "0") || 0,
          };
        });

        if (existingQuote) {
          await supabaseAdmin.from("factory_quotes").update({
            status: "processed",
            factory_name: saveFactoryName,
            processed_data: processedExtracted,
            raw_file_base64: file_base64 || null,
            raw_data: { source: "document_drop", file_name },
          }).eq("id", existingQuote.id);
        } else {
          await supabaseAdmin.from("factory_quotes").insert({
            job_id: jobId,
            factory_name: saveFactoryName,
            factory_email: saveFactoryEmail,
            status: "processed",
            processed_data: processedExtracted,
            raw_file_base64: file_base64 || null,
            raw_data: { source: "document_drop", file_name },
          });
        }
        await supabaseAdmin.from("factory_quote_jobs").update({
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
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

      // Resolve factory_id by name
      let resolvedFactoryId = factory_id;
      if (!resolvedFactoryId && factory_name) {
        const fMatch = (allFactories || []).find((f: any) =>
          f.name?.toLowerCase().includes(factory_name?.toLowerCase()) ||
          factory_name?.toLowerCase().includes(f.name?.toLowerCase())
        );
        if (fMatch) resolvedFactoryId = fMatch.id;
      }

      // Get PO number from extracted data
      const poNumber = extracted_data?.po_number || null;
      const paymentTerms = extracted_data?.payment_terms || null;

      let created = 0;
      for (const ep of (poProducts || [])) {
        const epSku = ep.sku?.trim().toLowerCase();
        const epName = ep.name?.trim().toLowerCase();
        const matched = (allProducts || []).find((p: any) =>
          (epSku && p.sku?.trim().toLowerCase() === epSku) ||
          (epName && p.name?.trim().toLowerCase().includes(epName)) ||
          (epName && epName.includes(p.name?.trim().toLowerCase()))
        );
        if (!matched) continue;

        const { data: existing } = await supabaseAdmin.from("plm_batches")
          .select("batch_number").eq("product_id", matched.id)
          .order("batch_number", { ascending: false }).limit(1);
        const batchNum = ((existing?.[0] as any)?.batch_number || 0) + 1;

        // Calculate unit price — divide total by qty if unit price looks like a total
        let rawPrice = ep.unit_price || ep.price || order_price || null;
        const epQty = ep.quantity || ep.qty || ep.moq || order_qty || null;
        if (rawPrice && epQty && parseFloat(rawPrice) > 100 && parseFloat(epQty) > 1) {
          rawPrice = (parseFloat(rawPrice) / parseFloat(epQty)).toFixed(2);
        }
        const unitPrice = rawPrice;

        await supabaseAdmin.from("plm_batches").insert({
          user_id: user.id,
          product_id: matched.id,
          factory_id: resolvedFactoryId || null,
          batch_number: batchNum,
          current_stage: "po_issued",
          order_quantity: ep.quantity || ep.qty || ep.moq || order_qty || null,
          quantity: ep.quantity || ep.qty || ep.moq || order_qty || null,
          unit_price: unitPrice ? parseFloat(unitPrice) : null,
          linked_po_number: poNumber,
          payment_terms: paymentTerms,
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

      // Resolve factory_id by name
      let fbFactoryId = factory_id;
      if (!fbFactoryId && factory_name) {
        const { data: allFacts } = await supabaseAdmin.from("factory_catalog").select("id, name").eq("user_id", user.id);
        const fMatch = (allFacts || []).find((f: any) =>
          f.name?.toLowerCase().includes(factory_name?.toLowerCase()) ||
          factory_name?.toLowerCase().includes(f.name?.toLowerCase())
        );
        if (fMatch) fbFactoryId = fMatch.id;
      }

      let updated = 0;
      for (const ep of (feedbackProducts || [])) {
        const epSku = ep.sku?.trim().toLowerCase();
        const epName = ep.name?.trim().toLowerCase();
        const matched = (allProducts || []).find((p: any) =>
          (epSku && p.sku?.trim().toLowerCase() === epSku) ||
          (epName && p.name?.trim().toLowerCase().includes(epName)) ||
          (epName && epName.includes(p.name?.trim().toLowerCase()))
        );
        if (!matched) continue;

        const feedbackText = ep.feedback || ep.feedback_notes || ep.notes || feedback_notes || "";
        const note = `[Sample Feedback - ${factory_name || "Factory"} - ${new Date().toLocaleDateString()}]\n${feedbackText}`;

        // Save to product notes
        const updatedNotes = matched.notes ? `${matched.notes}\n\n${note}` : note;
        await supabaseAdmin.from("plm_products").update({ notes: updatedNotes, updated_at: new Date().toISOString() }).eq("id", matched.id);

        // Also save to factory track notes if factory known
        if (fbFactoryId) {
          const { data: track } = await supabaseAdmin.from("plm_factory_tracks")
            .select("id, notes").eq("product_id", matched.id).eq("factory_id", fbFactoryId).single();
          if (track) {
            const trackNotes = track.notes ? `${track.notes}\n\n${note}` : note;
            await supabaseAdmin.from("plm_factory_tracks").update({ notes: trackNotes, updated_at: new Date().toISOString() }).eq("id", track.id);
          }
        }
        updated++;
      }

      return NextResponse.json({ success: true, message: `Added feedback to ${updated} products` });
    }

    // ── PRODUCT IMPORT
    if (doc_type === "product_import") {
      console.log("product_import extracted_data:", JSON.stringify(extracted_data));
      const { products: importProducts, collection_name } = extracted_data || {};

      // Build a map of collection names to IDs (create if needed)
      const collectionMap: Record<string, string> = {};
      const uniqueCollections = new Set<string>();
      
      // Gather all unique collection names from products
      for (const p of (importProducts || [])) {
        if (p.collection) uniqueCollections.add(p.collection);
      }
      // Only use sheet-level collection_name if no per-product collections found
      if (collection_name && uniqueCollections.size === 0) uniqueCollections.add(collection_name);
      
      // Create or find each collection
      for (const colName of Array.from(uniqueCollections)) {
        const { data: existing } = await supabaseAdmin.from("plm_collections")
          .select("id").eq("user_id", user.id).ilike("name", colName).single();
        if (existing) {
          collectionMap[colName.toLowerCase()] = existing.id;
        } else {
          const { data: newCol } = await supabaseAdmin.from("plm_collections")
            .insert({ user_id: user.id, name: colName }).select("id").single();
          if (newCol) collectionMap[colName.toLowerCase()] = newCol.id;
        }
      }
      
      // Legacy single collection fallback
      let collectionId = collection_name ? collectionMap[collection_name.toLowerCase()] : null;

      // Extract images from Excel zip
      const images = file_base64 ? await extractExcelImages(file_base64) : [];
      console.log(`Extracted ${images.length} images from Excel`);

      let created = 0;
      const validProducts = (importProducts || []).filter((ep: any) => ep.name);

      for (let i = 0; i < validProducts.length; i++) {
        const ep = validProducts[i];

        // Insert product
        const { data: newProduct } = await supabaseAdmin.from("plm_products").insert({
          user_id: user.id,
          name: ep.name,
          sku: ep.sku || null,
          description: ep.description || null,
          specs: ep.specs || null,
          category: ep.category || null,
          collection_id: ep.collection ? (collectionMap[ep.collection.toLowerCase()] || collectionId) : collectionId,
          status: "concept",
          killed: false,
        }).select("id").single();

        // Upload image if available for this product row
        if (newProduct && images[i]) {
          try {
            const imgBuffer = images[i];
            const ext = "jpg";
            const imgPath = `${user.id}/${newProduct.id}/imported_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabaseAdmin.storage
              .from("plm-images")
              .upload(imgPath, imgBuffer, { contentType: "image/jpeg", upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabaseAdmin.storage.from("plm-images").getPublicUrl(imgPath);
              const { error: updateError } = await supabaseAdmin.from("plm_products").update({
                images: [urlData.publicUrl], updated_at: new Date().toISOString()
              }).eq("id", newProduct.id);
              console.log(`Image saved for ${ep.name}: ${urlData.publicUrl} updateError: ${updateError?.message}`);
            } else {
              console.log(`Upload error for ${ep.name}:`, uploadError.message);
            }
          } catch (imgErr) {
            console.log("Image upload failed for product", ep.name, imgErr);
          }
        }
        created++;
      }

      return NextResponse.json({ success: true, message: `Created ${created} products${collection_name ? ` in "${collection_name}"` : ""}${images.length > 0 ? ` with ${Math.min(images.length, created)} images` : ""}` });
    }

    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
