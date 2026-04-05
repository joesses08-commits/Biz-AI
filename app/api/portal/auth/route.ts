import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      factory_id: portalUser.factory_id,
      factory_name: portalUser.factory_catalog?.name,
    },
  });
}
