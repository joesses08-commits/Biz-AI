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
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "update_batch") {
    const { id, factory_id, target_elc, actual_elc, target_sell_price, order_quantity, moq, linked_po_number, tracking_number, batch_notes } = body;
    const { error } = await supabaseAdmin.from("plm_batches").update({
      factory_id: factory_id || null,
      target_elc: target_elc || null,
      actual_elc: actual_elc || null,
      target_sell_price: target_sell_price || null,
      order_quantity: order_quantity || null,
      moq: moq || null,
      linked_po_number: linked_po_number || null,
      tracking_number: tracking_number || null,
      batch_notes: batch_notes || null,
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
