import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.acacia" as any,
});

const planPrices: Record<string, number> = {
  starter: 29900,
  growth: 99900,
  professional: 250000,
};

export async function POST(request: NextRequest) {
  const { email, plan } = await request.json();

  try {
    const amount = planPrices[plan] || 29900;

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BizAI ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: "AI Operating System for Business",
            },
            unit_amount: amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
    });

    return NextResponse.json({ url: paymentLink.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
