import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { bustDashboardCache } from "@/lib/bust-cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

  // Handle new client payment — create account + send welcome email
  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const session = event.data.object as any;
    const email = session.customer_details?.email || session.receipt_email;
    const customerName = session.customer_details?.name || "there";
    const plan = session.metadata?.plan || "starter";

    if (email) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const userExists = existingUsers?.users?.find(u => u.email === email);

      if (!userExists) {
        const tempPassword = generateTempPassword();

        const { error: createError } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            plan,
            must_reset_password: true,
            customer_name: customerName,
          },
        });

        if (!createError) {
          await supabase.from("customers").update({ status: "active" }).eq("email", email);

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
    }
  }

  // Process ALL Stripe events into Company Brain
  try {
    const eventObj = event.data.object as any;
    let rawData = "";
    let eventType = event.type;

    if (event.type === "payment_intent.succeeded") {
      const amount = (eventObj.amount / 100).toFixed(2);
      const customer = eventObj.customer || "unknown";
      rawData = `Payment succeeded: $${amount} from customer ${customer}. Payment ID: ${eventObj.id}. Description: ${eventObj.description || "none"}.`;
    } else if (event.type === "payment_intent.payment_failed") {
      const amount = (eventObj.amount / 100).toFixed(2);
      rawData = `Payment FAILED: $${amount} attempted. Reason: ${eventObj.last_payment_error?.message || "unknown"}. Customer: ${eventObj.customer || "unknown"}.`;
    } else if (event.type === "customer.subscription.created") {
      const amount = ((eventObj.plan?.amount || 0) / 100).toFixed(2);
      rawData = `New subscription created: $${amount}/${eventObj.plan?.interval || "month"}. Customer: ${eventObj.customer}. Plan: ${eventObj.plan?.nickname || eventObj.plan?.id || "unknown"}.`;
    } else if (event.type === "customer.subscription.deleted") {
      rawData = `Subscription CANCELLED. Customer: ${eventObj.customer}. Plan: ${eventObj.plan?.nickname || "unknown"}. Reason: ${eventObj.cancellation_details?.reason || "not specified"}.`;
    } else if (event.type === "invoice.payment_failed") {
      const amount = (eventObj.amount_due / 100).toFixed(2);
      rawData = `Invoice payment failed: $${amount} due. Customer: ${eventObj.customer_email || eventObj.customer}. Attempt: ${eventObj.attempt_count}.`;
    } else if (event.type === "customer.created") {
      rawData = `New customer created: ${eventObj.email || eventObj.id}. Name: ${eventObj.name || "unknown"}.`;
    }

    if (rawData) {
      // Find which Jimmy AI user has this Stripe connected
      const { data: stripeConns } = await supabase
        .from("stripe_connections")
        .select("user_id")
        .limit(50);

      if (stripeConns?.length) {
        for (const conn of stripeConns) {
          const { data: profile } = await supabase
            .from("company_profiles")
            .select("company_brief")
            .eq("user_id", conn.user_id)
            .single();

          bustDashboardCache(conn.user_id).catch(() => {});
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: conn.user_id,
              source: "Stripe",
              eventType,
              rawData,
              companyContext: profile?.company_brief || "",
            }),
          });
        }
      }
    }
  } catch (err) {
    console.error("Event processing error:", err);
  }

  return NextResponse.json({ received: true });
}
