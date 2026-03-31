import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" as any });

const TOKEN_PACKS: Record<string, number> = {
  "price_1TGqneLyxBan4QvlWZifLXz": 10000,
  "price_1TGqoMLYyxBan4QvZNeRgbe0": 25000,
  "price_1TGqohLyxBan4Qv5cahkd9Q": 50000,
  "price_1TGqo1LyxBan4QvpHLbM2Vg": 100000,
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { priceId } = await request.json();

    if (!TOKEN_PACKS[priceId]) {
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/quota?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/quota`,
      metadata: {
        userId: user.id,
        priceId,
        tokens: TOKEN_PACKS[priceId].toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
