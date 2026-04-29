import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "login") {
    const { email, password } = body;
    const pin_hash = createHash("sha256").update(password + "jimmy-warehouse-salt").digest("hex");
    const { data: user } = await supabaseAdmin
      .from("warehouse_portal_users")
      .select("*, warehouses(id, name, city, state)")
      .eq("email", email)
      .eq("pin_hash", pin_hash)
      .limit(1)
      .single();
    if (!user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401, headers: corsHeaders });
    return NextResponse.json({ success: true, user }, { headers: corsHeaders });
  }

  if (action === "get_inventory") {
    const { warehouse_id, user_id } = body;
    const { data } = await supabaseAdmin
      .from("inventory")
      .select("*, plm_products(id, name, sku, images)")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user_id);
    return NextResponse.json({ inventory: data || [] }, { headers: corsHeaders });
  }

  if (action === "get_shipments") {
    const { warehouse_id, user_id } = body;
    const { data } = await supabaseAdmin
      .from("inventory")
      .select("*, plm_products(id, name, sku, images)")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user_id)
      .gt("quantity_incoming", 0);
    return NextResponse.json({ shipments: data || [] }, { headers: corsHeaders });
  }

  if (action === "receive_goods") {
    const { inventory_id, quantity_received, notes, user_id } = body;
    const qty = parseInt(quantity_received) || 0;
    if (qty <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400, headers: corsHeaders });
    const { data: inv } = await supabaseAdmin.from("inventory").select("quantity_incoming, quantity_on_hand").eq("id", inventory_id).single();
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    await supabaseAdmin.from("inventory").update({
      quantity_incoming: Math.max(0, (inv.quantity_incoming || 0) - qty),
      quantity_on_hand: (inv.quantity_on_hand || 0) + qty,
      updated_at: new Date().toISOString(),
    }).eq("id", inventory_id);
    await supabaseAdmin.from("inventory_movements").insert({
      inventory_id, user_id, movement_type: "receive", quantity: qty,
      notes: notes || "Goods received", created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }

  if (action === "report_damage") {
    const { inventory_id, quantity_damaged, notes, user_id } = body;
    const qty = parseInt(quantity_damaged) || 0;
    if (qty <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400, headers: corsHeaders });
    const { data: inv } = await supabaseAdmin.from("inventory").select("quantity_on_hand").eq("id", inventory_id).single();
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    await supabaseAdmin.from("inventory").update({
      quantity_on_hand: Math.max(0, (inv.quantity_on_hand || 0) - qty),
      quantity_damaged: ((inv as any).quantity_damaged || 0) + qty,
      updated_at: new Date().toISOString(),
    }).eq("id", inventory_id);
    await supabaseAdmin.from("inventory_movements").insert({
      inventory_id, user_id, movement_type: "damage", quantity: qty,
      notes: notes || "Damage reported", created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }

  if (action === "get_messages") {
    const { user_id, warehouse_id } = body;
    const { data } = await supabaseAdmin
      .from("warehouse_messages")
      .select("*")
      .eq("user_id", user_id)
      .eq("warehouse_id", warehouse_id)
      .order("created_at", { ascending: true });
    return NextResponse.json({ messages: data || [] }, { headers: corsHeaders });
  }

  if (action === "send_message") {
    const { user_id, warehouse_id, message, sender_role, sender_name } = body;
    await supabaseAdmin.from("warehouse_messages").insert({
      user_id, warehouse_id, message, sender_role, sender_name,
      created_at: new Date().toISOString(),
    });
    // Notify admin if message is from warehouse
    if (sender_role === "warehouse") {
      const { data: warehouse } = await supabaseAdmin.from("warehouses").select("name").eq("id", warehouse_id).single();
      await createNotification({ user_id, type: "message", title: `New message — ${warehouse?.name || "Warehouse"}`, body: `${sender_name}: ${message}`, link: "/messages" }).catch(() => {});
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
}
