import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { auditLog } from "@/lib/audit";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function hashPin(pin: string) {
  return createHash("sha256").update(pin + "jimmy-pin-salt").digest("hex");
}

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
  const body = await req.json();
  const { action } = body;

  // Set PIN (onboarding or reset)
  if (action === "set_pin") {
    const { pin, reset_token } = body;
    if (!pin || pin.length < 4) return NextResponse.json({ error: "PIN must be at least 4 digits" }, { status: 400 });

    if (reset_token) {
      // Reset flow — verify token
      const { data: profile } = await supabaseAdmin.from("profiles").select("id, pin_reset_token, pin_reset_expires_at").eq("pin_reset_token", reset_token).single();
      if (!profile) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
      if (new Date(profile.pin_reset_expires_at) < new Date()) return NextResponse.json({ error: "Token expired" }, { status: 400 });
      await supabaseAdmin.from("profiles").update({ admin_pin: hashPin(pin), pin_reset_token: null, pin_reset_expires_at: null }).eq("id", profile.id);
      return NextResponse.json({ success: true });
    }

    // Normal set (onboarding)
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await supabaseAdmin.from("profiles").update({ admin_pin: hashPin(pin) }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  // Verify PIN
  if (action === "verify_pin") {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { pin } = body;
    const { data: profile } = await supabaseAdmin.from("profiles").select("admin_pin").eq("id", user.id).single();
    // Fall back to env var if no DB pin set yet
    const envPin = process.env.ADMIN_MILESTONE_PIN;
    if (!profile?.admin_pin) {
      if (pin === envPin) return NextResponse.json({ success: true });
      auditLog(user.id, "pin_failed", {}).catch(() => {});
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
    if (profile.admin_pin === hashPin(pin)) {
      auditLog(user.id, "pin_verified", {}).catch(() => {});
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  // Forgot PIN — send reset email
  if (action === "forgot_pin") {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour
    await supabaseAdmin.from("profiles").update({ pin_reset_token: token, pin_reset_expires_at: expires }).eq("id", user.id);
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-pin?token=${token}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Jimmy AI <joey@myjimmy.ai>",
        to: user.email,
        subject: "Reset your Jimmy AI Admin PIN",
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Reset your Admin PIN</h2>
          <p style="color:#666;font-size:14px;margin-bottom:24px">Click the button below to set a new Admin PIN for your Jimmy AI account. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Reset PIN →</a>
          <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
      }),
    });
    return NextResponse.json({ success: true });
  }

  // Check if PIN is set
  if (action === "has_pin") {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabaseAdmin.from("profiles").select("admin_pin").eq("id", user.id).single();
    return NextResponse.json({ has_pin: !!profile?.admin_pin });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
