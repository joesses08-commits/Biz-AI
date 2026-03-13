import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Get user's connected Stripe token
    const { data: stripeConn } = await supabase
      .from("stripe_connections")
      .select("access_token, stripe_user_id")
      .eq("user_id", user.id)
      .single();

    // Fall back to server key if no connected account
    const accessToken = stripeConn?.access_token || process.env.STRIPE_SECRET_KEY!;

    const stripe = new Stripe(accessToken, {
      apiVersion: "2026-02-25.clover",
    });

    const [charges, customers, subscriptions, balance] = await Promise.all([
      stripe.charges.list({ limit: 20 }),
      stripe.customers.list({ limit: 100 }),
      stripe.subscriptions.list({ limit: 100, status: "active" }),
      stripe.balance.retrieve(),
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

    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;

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
      availableBalance,
      recentTransactions,
      connected: !!stripeConn,
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
