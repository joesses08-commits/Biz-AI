import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const planPrices: Record<string, number> = {
  starter: 29900,
  growth: 99900,
  professional: 250000,
  enterprise: 499900,
};

export async function POST(request: NextRequest) {
  const { email, plan, customerId } = await request.json();

  try {
    const amount = planPrices[plan] || 29900;
    const planName = `Jimmy AI ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;

    const product = await stripe.products.create({
      name: planName,
      description: "AI Operating System for Business",
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval: "month" },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { plan, customer_email: email, customer_id: customerId || "" },
      after_completion: {
        type: "redirect",
        redirect: { url: "https://myjimmy.ai/login" },
      },
    });

    return NextResponse.json({ url: paymentLink.url });
  } catch (error: any) {
    console.error("Payment link error:", error);
    return NextResponse.json({ error: error.message });
  }
}
