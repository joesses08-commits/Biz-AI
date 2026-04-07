import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: NextRequest) {
  // Verify or set portal user PIN
  const body = await req.json();
  const { action, token, pin } = body;
  const crypto = await import("crypto");

  if (action === "verify_pin") {
    const { data: portalUser } = await supabaseAdmin.from("factory_portal_users")
      .select("pin_hash").eq("session_token", token).single();
    if (!portalUser) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const hash = crypto.createHash("sha256").update(pin).digest("hex");
    if (portalUser.pin_hash === hash) return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (action === "set_pin") {
    const { data: portalUser } = await supabaseAdmin.from("factory_portal_users")
      .select("id").eq("session_token", token).single();
    if (!portalUser) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const hash = crypto.createHash("sha256").update(pin).digest("hex");
    await supabaseAdmin.from("factory_portal_users").update({ pin_hash: hash }).eq("id", portalUser.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 });

  // Look up factory portal user
  const { data: portalUser } = await supabaseAdmin
    .from("factory_portal_users")
    .select("*, factory_catalog(name)")
    .eq("email", email.toLowerCase())
    .single();

  if (!portalUser) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  // Check password (stored as SHA256 hash)
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (portalUser.password_hash !== hash) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  // Generate simple token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Store token
  await supabaseAdmin.from("factory_portal_users").update({
    session_token: token,
    session_expires_at: expiresAt,
  }).eq("id", portalUser.id);

  return NextResponse.json({
    token,
    user: {
      id: portalUser.id,
      email: portalUser.email,
      name: portalUser.name,
      role: portalUser.role || "factory",
      factory_id: portalUser.factory_id,
      factory_name: portalUser.factory_catalog?.name,
      user_id: portalUser.user_id,
    },
  });
}
