import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.acacia" as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const session = event.data.object as any;
    const email = session.customer_details?.email || session.receipt_email;
    const customerName = session.customer_details?.name || "there";
    const plan = session.metadata?.plan || "starter";

    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === email);

    if (!userExists) {
      const tempPassword = generateTempPassword();

      // Create Supabase auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          plan,
          must_reset_password: true,
          customer_name: customerName,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      // Update customers table status to active
      await supabase.from("customers").update({ status: "active" }).eq("email", email);

      // Send welcome email
      await resend.emails.send({
        from: "Jimmy AI <onboarding@resend.dev>",
        to: email,
        subject: "Welcome to Jimmy AI — Your login details",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="font-size: 28px; font-weight: 700; margin: 0;">Welcome to Jimmy AI</h1>
              <p style="color: #666; margin-top: 8px;">Your AI COO is ready.</p>
            </div>
            
            <p style="color: #ccc;">Hi ${customerName},</p>
            <p style="color: #ccc;">Your Jimmy AI account is live. Here are your login details:</p>
            
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">${email}</p>
              <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
              <p style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #fff;">${tempPassword}</p>
            </div>
            
            <p style="color: #ccc;">You will be asked to set a new password when you first log in.</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://myjimmy.ai/login" style="background: #ffffff; color: #000000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
                Log In to Jimmy AI →
              </a>
            </div>
            
            <p style="color: #444; font-size: 12px; text-align: center; margin-top: 40px;">
              If you have any questions, reply to this email or contact us at jo.esses08@gmail.com
            </p>
          </div>
        `,
      });
    }
  }

  return NextResponse.json({ received: true });
}
