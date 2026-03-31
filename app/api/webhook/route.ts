import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICE_TO_TOKENS: Record<string, number> = {
  "price_1TGubfLYyxBan4QvzDH75ZHD": 10000,
  "price_1TGudULYyxBan4Qvq49EOsze": 25000,
  "price_1TGue9LYyxBan4QvWAkqZpk6": 50000,
  "price_1TGueeLYyxBan4QvVY3UFTMA": 100000,
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const priceId = session.metadata?.priceId;

    if (userId && priceId && PRICE_TO_TOKENS[priceId]) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const tokensToAdd = PRICE_TO_TOKENS[priceId];

      const { data: quota } = await supabase
        .from("user_quota")
        .select("tokens_remaining")
        .eq("user_id", userId)
        .single();

      if (quota) {
        await supabase
          .from("user_quota")
          .update({ tokens_remaining: quota.tokens_remaining + tokensToAdd })
          .eq("user_id", userId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
