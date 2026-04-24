import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

async function buildPLMContext(userId: string): Promise<string> {
  const [
    { data: products },
    { data: factories },
    { data: tracks },
    { data: collections },
    { data: orders },
  ] = await Promise.all([
    supabaseAdmin.from("plm_products").select("id, name, sku, killed, status, action_status, action_note, notes, factory_notes, collection_id, plm_collections(name, season, year)").eq("user_id", userId),
    supabaseAdmin.from("factory_catalog").select("id, name, email, contact_name, notes").eq("user_id", userId),
    supabaseAdmin.from("plm_factory_tracks").select("id, product_id, factory_id, status, approved_price, notes, factory_catalog(id, name, email), plm_products(id, name, sku), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number, notes)").eq("user_id", userId),
    supabaseAdmin.from("plm_collections").select("id, name, season, year").eq("user_id", userId),
    supabaseAdmin.from("plm_batches").select("id, product_id, factory_id, current_stage, order_quantity, unit_price, elc, sell_price, linked_po_number, factory_catalog(name)").eq("user_id", userId),
  ]);

  const lines: string[] = ["=== PLM DATA ===\n"];

  if (collections?.length) {
    lines.push(`COLLECTIONS: ${collections.map((c: any) => `${c.name} (id:${c.id})`).join(", ")}\n`);
  }

  if (factories?.length) {
    lines.push("FACTORIES:");
    factories.forEach((f: any) => {
      lines.push(`  - ${f.name} (id:${f.id}, email:${f.email || "none"})`);
    });
    lines.push("");
  }

  if (products?.length) {
    lines.push("PRODUCTS:");
    (products || []).filter((p: any) => !p.killed && p.status !== "killed").forEach((p: any) => {
      const pt = (tracks || []).filter((t: any) => t.product_id === p.id);
      const approved = pt.find((t: any) => t.status === "approved");
      lines.push(`  - ${p.name} (id:${p.id}, sku:${p.sku || "none"}, collection:${(p as any).plm_collections?.name || "none"})${p.status === "hold" ? " [HOLD]" : ""}${p.action_status === "action_required" ? " [ACTION REQUIRED]" : ""}`);
      pt.forEach((t: any) => {
        const stages = (t.plm_track_stages || []);
        const done = stages.filter((s: any) => s.status === "done").map((s: any) => s.stage);
        const latest = ["sample_reviewed","sample_arrived","sample_shipped","sample_complete","sample_production","sample_requested","quote_received","quote_requested","artwork_sent"].find(s => done.includes(s));
        const quoted = stages.find((s: any) => s.stage === "quote_received" && s.quoted_price)?.quoted_price;
        const revs = stages.filter((s: any) => s.stage === "revision_requested").length;
        lines.push(`      Track: ${(t as any).factory_catalog?.name} (track_id:${t.id}, factory_id:${t.factory_id}) — ${t.status}${latest ? ` @ ${latest}` : ""}${quoted ? ` quoted:$${quoted}` : ""}${revs > 0 ? ` revisions:${revs}` : ""}${approved ? " ✓APPROVED" : ""}`);
      });
    });
    lines.push("");
  }

  if (orders?.length) {
    lines.push("ORDERS:");
    orders.forEach((o: any) => {
      const prod = (products || []).find((p: any) => p.id === o.product_id);
      lines.push(`  - ${prod?.name || "?"} @ ${(o as any).factory_catalog?.name}: ${o.order_quantity} units, ${o.current_stage}${o.elc ? ` ELC:$${o.elc}` : ""}${o.linked_po_number ? ` PO:${o.linked_po_number}` : ""} (order_id:${o.id})`);
    });
  }

  return lines.join("\n");
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_messages",
    description: "Get recent messages from a factory track. Use to check what's been discussed.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "The factory track ID" },
        limit: { type: "number", description: "Number of messages to retrieve (default 10)" }
      },
      required: ["track_id"]
    }
  },
  {
    name: "send_message",
    description: "Send a message to a factory via their product track chat.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "The factory track ID" },
        product_id: { type: "string", description: "The product ID" },
        message: { type: "string", description: "The message to send" }
      },
      required: ["track_id", "product_id", "message"]
    }
  },
  {
    name: "request_sample",
    description: "Request a sample from one or more factories for a product.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_id: { type: "string", description: "The product ID" },
        factory_ids: { type: "array", items: { type: "string" }, description: "List of factory IDs to request from" },
        note: { type: "string", description: "Optional note to include with the sample request" }
      },
      required: ["product_id", "factory_ids"]
    }
  },
  {
    name: "update_track_stage",
    description: "Update a factory track stage (e.g. mark artwork_sent, quote_received, sample_requested as done).",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string", description: "The factory track ID" },
        product_id: { type: "string", description: "The product ID" },
        factory_id: { type: "string", description: "The factory ID" },
        stage: { type: "string", description: "Stage key: artwork_sent, quote_requested, quote_received, sample_requested, sample_production, sample_complete, sample_shipped, sample_arrived, sample_reviewed" },
        notes: { type: "string", description: "Optional notes" },
        quoted_price: { type: "number", description: "Price if stage is quote_received" }
      },
      required: ["track_id", "product_id", "factory_id", "stage"]
    }
  },
  {
    name: "add_note",
    description: "Add or update a note on a product or factory track.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["product", "track"], description: "Whether to add note to product or factory track" },
        id: { type: "string", description: "The product ID or track ID" },
        note: { type: "string", description: "The note to add" },
        field: { type: "string", enum: ["notes", "factory_notes"], description: "For products: which field to update (notes=internal, factory_notes=visible to factory)" }
      },
      required: ["type", "id", "note"]
    }
  },
  {
    name: "create_order",
    description: "Create a production order for a product.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_id: { type: "string", description: "The product ID" },
        factory_id: { type: "string", description: "The factory ID" },
        order_quantity: { type: "number", description: "Number of units" },
        unit_price: { type: "number", description: "First cost / unit price" },
        tariff: { type: "number", description: "Tariff amount per unit" },
        freight: { type: "number", description: "Freight cost per unit" },
        duty: { type: "number", description: "Duty cost per unit" },
        linked_po_number: { type: "string", description: "PO number if available" },
        payment_terms: { type: "string", description: "Payment terms e.g. 30% deposit, 70% before shipment" }
      },
      required: ["product_id", "factory_id", "order_quantity"]
    }
  },
  {
    name: "send_po_email",
    description: "Generate and send a PO email to a factory. Creates the order if needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        factory_id: { type: "string", description: "The factory ID" },
        product_ids: { type: "array", items: { type: "string" }, description: "List of product IDs on this PO" },
        po_number: { type: "string", description: "PO number" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              product_name: { type: "string" },
              sku: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" }
            }
          },
          description: "Line items on the PO"
        },
        notes: { type: "string", description: "Additional notes for the PO" }
      },
      required: ["factory_id", "items"]
    }
  },
  {
    name: "get_product_details",
    description: "Get full details about a specific product including all tracks, stages, messages, and orders.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_id: { type: "string", description: "The product ID" }
      },
      required: ["product_id"]
    }
  }
];

async function executeTool(name: string, input: any, userId: string): Promise<string> {
  try {
    if (name === "get_messages") {
      const limit = input.limit || 10;
      const { data } = await supabaseAdmin.from("track_messages")
        .select("sender_name, sender_role, message, created_at")
        .eq("track_id", input.track_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!data?.length) return "No messages found for this track.";
      return data.reverse().map((m: any) => `[${m.sender_role}] ${m.sender_name}: ${m.message}`).join("\n");
    }

    if (name === "send_message") {
      const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).single();
      await supabaseAdmin.from("track_messages").insert({
        track_id: input.track_id, product_id: input.product_id, user_id: userId,
        sender_role: "admin", sender_name: profile?.full_name || "Admin", message: input.message
      });
      return `Message sent: "${input.message}"`;
    }

    if (name === "request_sample") {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_sample_requests", product_id: input.product_id, factory_ids: input.factory_ids, note: input.note || "", provider: "gmail" })
      });
      const data = await res.json();
      // Also update track stages
      const { data: tracks } = await supabaseAdmin.from("plm_factory_tracks").select("id, factory_id").eq("product_id", input.product_id).in("factory_id", input.factory_ids);
      for (const track of (tracks || [])) {
        const { data: existing } = await supabaseAdmin.from("plm_track_stages").select("id").eq("track_id", track.id).eq("stage", "sample_requested").maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("plm_track_stages").insert({ track_id: track.id, product_id: input.product_id, factory_id: track.factory_id, stage: "sample_requested", status: "done", revision_number: 0, actual_date: new Date().toISOString().split("T")[0], notes: input.note || null, user_id: userId });
        }
      }
      return `Sample requested from ${input.factory_ids.length} factory/factories. Emails sent.`;
    }

    if (name === "update_track_stage") {
      const extra: any = { actual_date: new Date().toISOString().split("T")[0] };
      if (input.notes) extra.notes = input.notes;
      if (input.quoted_price) extra.quoted_price = input.quoted_price;
      const { data: existing } = await supabaseAdmin.from("plm_track_stages").select("id").eq("track_id", input.track_id).eq("stage", input.stage).maybeSingle();
      if (existing) {
        await supabaseAdmin.from("plm_track_stages").update({ status: "done", ...extra }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("plm_track_stages").insert({ track_id: input.track_id, product_id: input.product_id, factory_id: input.factory_id, stage: input.stage, status: "done", revision_number: 0, user_id: userId, ...extra });
      }
      return `Stage "${input.stage}" marked as done.`;
    }

    if (name === "add_note") {
      if (input.type === "product") {
        const field = input.field || "notes";
        const { data: prod } = await supabaseAdmin.from("plm_products").select(field).eq("id", input.id).single();
        const existing = (prod as any)?.[field] || "";
        const updated = existing ? `${existing}\n${input.note}` : input.note;
        await supabaseAdmin.from("plm_products").update({ [field]: updated }).eq("id", input.id);
        return `Note added to product (${field}).`;
      } else {
        const { data: track } = await supabaseAdmin.from("plm_factory_tracks").select("notes").eq("id", input.id).single();
        const existing = track?.notes || "";
        const updated = existing ? `${existing}\n${input.note}` : input.note;
        await supabaseAdmin.from("plm_factory_tracks").update({ notes: updated }).eq("id", input.id);
        return `Note added to factory track.`;
      }
    }

    if (name === "create_order") {
      const tariff = input.tariff || 0;
      const freight = input.freight || 0;
      const duty = input.duty || 0;
      const unitPrice = input.unit_price || 0;
      const elc = unitPrice + tariff + freight + duty;
      const { data: existing } = await supabaseAdmin.from("plm_batches").select("batch_number").eq("product_id", input.product_id).order("batch_number", { ascending: false }).limit(1).maybeSingle();
      const batchNum = ((existing as any)?.batch_number || 0) + 1;
      await supabaseAdmin.from("plm_batches").insert({
        product_id: input.product_id, factory_id: input.factory_id, user_id: userId,
        batch_number: batchNum, current_stage: "po_issued",
        order_quantity: input.order_quantity, unit_price: unitPrice || null,
        tariff_pct: tariff || null, freight: freight || null, duty_pct: duty || null,
        elc: elc || null, linked_po_number: input.linked_po_number || null,
        payment_terms: input.payment_terms || null
      });
      return `Order created: ${input.order_quantity} units${elc > 0 ? ` @ $${elc.toFixed(2)} ELC` : ""}${input.linked_po_number ? ` (PO: ${input.linked_po_number})` : ""}`;
    }

    if (name === "send_po_email") {
      const { data: factory } = await supabaseAdmin.from("factory_catalog").select("name, email, contact_name").eq("id", input.factory_id).single();
      if (!factory?.email) return "Factory has no email address. PO could not be sent.";

      const itemsText = (input.items || []).map((item: any) =>
        `- ${item.product_name || item.product_id}${item.sku ? ` (${item.sku})` : ""}: ${item.quantity} units @ $${item.unit_price || "TBD"}`
      ).join("\n");

      const poNumber = input.po_number || `PO-${Date.now()}`;
      const emailBody = `Hi ${factory.contact_name || factory.name},

Please find below our Purchase Order ${poNumber}.

ORDER DETAILS:
${itemsText}

${input.notes ? `Notes: ${input.notes}\n` : ""}Please confirm receipt and production timeline.

Best regards`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: [factory.email],
          subject: `Purchase Order ${poNumber} — Jimmy`,
          text: emailBody
        })
      });

      if (!emailRes.ok) return `Failed to send PO email to ${factory.email}.`;
      return `PO email sent to ${factory.name} (${factory.email}) with ${input.items.length} line items.`;
    }

    if (name === "get_product_details") {
      const { data: product } = await supabaseAdmin.from("plm_products")
        .select("*, plm_collections(name), plm_factory_tracks(*, factory_catalog(name, email), plm_track_stages(*)), plm_batches(*, factory_catalog(name))")
        .eq("id", input.product_id).single();
      if (!product) return "Product not found.";
      return JSON.stringify(product, null, 2).slice(0, 3000);
    }

    return "Unknown tool.";
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history = [] } = await req.json();
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

  const plmContext = await buildPLMContext(user.id);

  const systemPrompt = `You are Jimmy's PLM Agent — a powerful AI assistant that manages wholesale product lifecycle operations. You have complete access to all PLM data AND can take real actions.

You can:
- Answer any question about products, factories, samples, orders, prices, stages
- Send messages to factories
- Request samples from factories  
- Update track stages (mark artwork sent, quote received, sample requested, etc.)
- Add notes to products or factory tracks
- Create production orders
- Generate and email Purchase Orders to factories
- Read message history with factories

Always use the tools when asked to take an action. Be decisive and execute commands directly. Confirm what you did after executing.

When creating POs, always include product name, SKU, quantity, and price in the email. Use professional but direct language.

${plmContext}

Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  let totalInput = 0;
  let totalOutput = 0;
  const actions: string[] = [];

  // Agentic loop
  const agentMessages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: message }
  ];

  let finalReply = "";
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      tools: TOOLS,
      messages: agentMessages,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    // Collect text
    const textBlock = response.content.find((c: any) => c.type === "text") as any;
    if (textBlock?.text) finalReply = textBlock.text;

    // If no tool use, we're done
    if (response.stop_reason === "end_turn" || !response.content.some((c: any) => c.type === "tool_use")) {
      break;
    }

    // Execute tools
    const toolUses = response.content.filter((c: any) => c.type === "tool_use") as any[];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const result = await executeTool(toolUse.name, toolUse.input, user.id);
      actions.push(`${toolUse.name}: ${result}`);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
    }

    // Add assistant response and tool results to messages
    agentMessages.push({ role: "assistant", content: response.content });
    agentMessages.push({ role: "user", content: toolResults });
  }

  await trackUsage(user.id, "plm_agent", "claude-sonnet-4-5", totalInput, totalOutput);

  return NextResponse.json({ reply: finalReply, actions });
}
