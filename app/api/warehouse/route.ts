import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "login") {
    const { email, password } = body;
    const pin_hash = createHash("sha256").update(password + "jimmy-warehouse-salt").digest("hex");
    const { data: user, error } = await supabaseAdmin
      .from("warehouse_portal_users")
      .select("*, warehouses(id, name, city, state)")
      .eq("email", email)
      .eq("pin_hash", pin_hash)
      .single();
    if (error || !user) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    return NextResponse.json({ success: true, user });
  }

  if (action === "get_inventory") {
    const { warehouse_id, user_id } = body;
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .select("*, plm_products(id, name, sku, images)")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inventory: data || [] });
  }

  if (action === "get_shipments") {
    const { warehouse_id, user_id } = body;
    const { data, error } = await supabaseAdmin
      .from("inventory")
      .select("*, plm_products(id, name, sku, images)")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user_id)
      .gt("incoming", 0);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shipments: data || [] });
  }

  if (action === "receive_goods") {
    const { inventory_id, quantity_received, notes, warehouse_user_id, user_id } = body;
    const qty = parseInt(quantity_received) || 0;
    if (qty <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    const { data: inv } = await supabaseAdmin.from("inventory").select("incoming, on_hand").eq("id", inventory_id).single();
    if (!inv) return NextResponse.json({ error: "Inventory not found" }, { status: 404 });

    const newIncoming = Math.max(0, (inv.incoming || 0) - qty);
    const newOnHand = (inv.on_hand || 0) + qty;

    await supabaseAdmin.from("inventory").update({
      incoming: newIncoming,
      on_hand: newOnHand,
      updated_at: new Date().toISOString(),
    }).eq("id", inventory_id);

    await supabaseAdmin.from("inventory_movements").insert({
      inventory_id,
      user_id,
      movement_type: "receive",
      quantity: qty,
      notes: notes || "Goods received",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  }

  if (action === "report_damage") {
    const { inventory_id, quantity_damaged, notes, user_id } = body;
    const qty = parseInt(quantity_damaged) || 0;
    if (qty <= 0) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    const { data: inv } = await supabaseAdmin.from("inventory").select("on_hand").eq("id", inventory_id).single();
    if (!inv) return NextResponse.json({ error: "Inventory not found" }, { status: 404 });

    const newOnHand = Math.max(0, (inv.on_hand || 0) - qty);

    await supabaseAdmin.from("inventory").update({
      on_hand: newOnHand,
      updated_at: new Date().toISOString(),
    }).eq("id", inventory_id);

    await supabaseAdmin.from("inventory_movements").insert({
      inventory_id,
      user_id,
      movement_type: "damage",
      quantity: qty,
      notes: notes || "Damage reported",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
