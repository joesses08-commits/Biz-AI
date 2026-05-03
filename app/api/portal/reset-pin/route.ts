import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export async function POST(req: NextRequest) {
  const { action, token, pin } = await req.json();

  if (action === "verify_token") {
    const { data } = await supabaseAdmin
      .from("factory_portal_users")
      .select("id, email, name, pin_reset_expires_at")
      .eq("pin_reset_token", token)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    if (new Date(data.pin_reset_expires_at) < new Date()) return NextResponse.json({ error: "Link has expired" }, { status: 400 });
    return NextResponse.json({ success: true, email: data.email, name: data.name });
  }

  if (action === "reset_pin") {
    if (!pin || pin.length < 4) return NextResponse.json({ error: "PIN must be at least 4 digits" }, { status: 400 });
    const { data } = await supabaseAdmin
      .from("factory_portal_users")
      .select("id, pin_reset_expires_at")
      .eq("pin_reset_token", token)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
    if (new Date(data.pin_reset_expires_at) < new Date()) return NextResponse.json({ error: "Link has expired" }, { status: 400 });
    await supabaseAdmin.from("factory_portal_users")
      .update({ pin_hash: hashPin(pin), pin_reset_token: null, pin_reset_expires_at: null })
      .eq("id", data.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
