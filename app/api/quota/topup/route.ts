import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PRICE_TO_TOKENS: Record<string, number> = {
  "price_1TGqneLyxBan4QvlWZifLXz": 10000,
  "price_1TGqoMLyxBan4QvZNeRgbe0": 25000,
  "price_1TGqohLyxBan4Qv5cahkd9Q": 50000,
  "price_1TGqo1LyxBan4QvpHLbM2Vg": 100000,
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe key missing" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { priceId } = await req.json();
    if (!PRICE_TO_TOKENS[priceId]) {
      return NextResponse.json({ error: "Invalid price ID: " + priceId }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/quota?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/quota?cancelled=true`,
      metadata: { userId: user.id, priceId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Topup error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
