import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/get-user";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



export async function POST(req: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "update_batch") {
    const { id, factory_id, target_elc, actual_elc, target_sell_price, order_quantity, moq, linked_po_number, tracking_number, batch_notes, unit_price, tariff, freight, duty, tariff_pct, duty_pct, elc, sell_price, margin } = body;
    const { error } = await supabaseAdmin.from("plm_batches").update({
      factory_id: factory_id !== undefined ? factory_id : undefined,
      target_elc: target_elc !== undefined ? target_elc : undefined,
      actual_elc: actual_elc !== undefined ? actual_elc : undefined,
      target_sell_price: target_sell_price !== undefined ? target_sell_price : undefined,
      order_quantity: order_quantity !== undefined ? order_quantity : undefined,
      moq: moq !== undefined ? moq : undefined,
      linked_po_number: linked_po_number !== undefined ? linked_po_number : undefined,
      tracking_number: tracking_number !== undefined ? tracking_number : undefined,
      batch_notes: batch_notes !== undefined ? batch_notes : undefined,
      unit_price: unit_price !== undefined ? unit_price : undefined,
      tariff: tariff !== undefined ? tariff : undefined,
      tariff_pct: tariff_pct !== undefined ? tariff_pct : undefined,
      duty_pct: duty_pct !== undefined ? duty_pct : undefined,
      freight: freight !== undefined ? freight : undefined,
      duty: duty !== undefined ? duty : undefined,
      elc: elc !== undefined ? elc : undefined,
      sell_price: sell_price !== undefined ? sell_price : undefined,
      margin: margin !== undefined ? margin : undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Sync tracking number to plm_shipments if a shipment record exists for this batch
    if (tracking_number) {
      await supabaseAdmin.from("plm_shipments").update({
        tracking_number,
        updated_at: new Date().toISOString(),
      }).eq("batch_id", id);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
