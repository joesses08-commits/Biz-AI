import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function GET() {
  try {
    const [charges, customers, subscriptions] = await Promise.all([
      stripe.charges.list({ limit: 20 }),
      stripe.customers.list({ limit: 100 }),
      stripe.subscriptions.list({ limit: 100, status: "active" }),
    ]);

    const totalRevenue = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0) / 100;

    const mrr = subscriptions.data.reduce((sum, s) => {
      const item = s.items.data[0];
      if (!item?.price?.unit_amount) return sum;
      const amount = item.price.unit_amount / 100;
      if (item.price.recurring?.interval === "year") return sum + amount / 12;
      return sum + amount;
    }, 0);

    const recentTransactions = charges.data.slice(0, 10).map(c => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      description: c.description || "Payment",
      date: new Date(c.created * 1000).toISOString(),
      paid: c.paid,
    }));

    return NextResponse.json({
      totalRevenue,
      mrr,
      activeSubscriptions: subscriptions.data.length,
      totalCustomers: customers.data.length,
      recentTransactions,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
