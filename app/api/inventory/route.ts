import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEffectiveUser } from "@/lib/get-user";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [warehousesRes, inventoryRes, movementsRes] = await Promise.all([
    supabaseAdmin.from("warehouses").select("*").eq("user_id", user.id).eq("active", true).order("name"),
    supabaseAdmin.from("inventory").select("*, plm_products(id, name, sku, images), warehouses(id, name, city, state)").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabaseAdmin.from("inventory_movements").select("*, plm_products(name, sku), warehouses(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);

  return NextResponse.json({
    warehouses: warehousesRes.data || [],
    inventory: inventoryRes.data || [],
    movements: movementsRes.data || [],
  });
}

export async function POST(request: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // Create warehouse
  if (action === "create_warehouse") {
    const { name, address, city, state, country, contact_name, contact_email, contact_phone, notes } = body;
    const { data, error } = await supabaseAdmin.from("warehouses").insert({
      user_id: user.id, name, address, city, state, country: country || "US",
      contact_name, contact_email, contact_phone, notes,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warehouse: data });
  }

  // Update warehouse
  if (action === "update_warehouse") {
    const { id, ...updates } = body;
    delete updates.action;
    const { data, error } = await supabaseAdmin.from("warehouses").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ warehouse: data });
  }

  // Delete warehouse
  if (action === "delete_warehouse") {
    const { id } = body;
    await supabaseAdmin.from("warehouses").update({ active: false }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  // Create/update inventory record (called when PO is issued)
  if (action === "upsert_inventory") {
    const { product_id, warehouse_id, quantity_incoming, cost_per_unit, po_number } = body;
    const { data: existing } = await supabaseAdmin.from("inventory").select("*").eq("product_id", product_id).eq("warehouse_id", warehouse_id).maybeSingle();
    
    if (existing) {
      const { data, error } = await supabaseAdmin.from("inventory").update({
        quantity_incoming: (existing.quantity_incoming || 0) + (quantity_incoming || 0),
        cost_per_unit: cost_per_unit || existing.cost_per_unit,
        po_number: po_number || existing.po_number,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ inventory: data });
    } else {
      const { data, error } = await supabaseAdmin.from("inventory").insert({
        user_id: user.id, product_id, warehouse_id, quantity_incoming: quantity_incoming || 0,
        cost_per_unit, po_number,
      }).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ inventory: data });
    }
  }

  // Receive inventory (warehouse marks goods arrived)
  if (action === "receive_inventory") {
    const { product_id, warehouse_id, quantity_received, notes, reference } = body;
    const { data: existing } = await supabaseAdmin.from("inventory").select("*").eq("product_id", product_id).eq("warehouse_id", warehouse_id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Inventory record not found" }, { status: 404 });

    const newIncoming = Math.max(0, (existing.quantity_incoming || 0) - quantity_received);
    const newOnHand = (existing.quantity_on_hand || 0) + quantity_received;

    const { data, error } = await supabaseAdmin.from("inventory").update({
      quantity_incoming: newIncoming,
      quantity_on_hand: newOnHand,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log movement
    await supabaseAdmin.from("inventory_movements").insert({
      user_id: user.id, product_id, warehouse_id,
      type: "received", quantity: quantity_received,
      reference, notes, created_by_role: "warehouse",
    });

    return NextResponse.json({ inventory: data });
  }

  // Manual adjustment
  if (action === "adjust_inventory") {
    const { product_id, warehouse_id, quantity_adjustment, notes } = body;
    const { data: existing } = await supabaseAdmin.from("inventory").select("*").eq("product_id", product_id).eq("warehouse_id", warehouse_id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Inventory record not found" }, { status: 404 });

    const newOnHand = Math.max(0, (existing.quantity_on_hand || 0) + quantity_adjustment);
    const { data, error } = await supabaseAdmin.from("inventory").update({
      quantity_on_hand: newOnHand,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("inventory_movements").insert({
      user_id: user.id, product_id, warehouse_id,
      type: "adjustment", quantity: quantity_adjustment,
      notes, created_by_role: "admin",
    });

    return NextResponse.json({ inventory: data });
  }

  // Create warehouse portal user
  if (action === "create_warehouse_user") {
    const { warehouse_id, name, email, password } = body;
    const { createHash } = await import("crypto");
    const pin_hash = createHash("sha256").update(password + "jimmy-warehouse-salt").digest("hex");
    const { data, error } = await supabaseAdmin.from("warehouse_portal_users").insert({
      user_id: user.id, warehouse_id, name, email, pin_hash,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
