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

    const connectedPlatforms: string[] = [];
    let stripeData = null;
    let gmailData = null;

    // Stripe
    try {
      // Get user connected Stripe token
      const { data: stripeConn } = await supabase.from("stripe_connections").select("access_token").eq("user_id", user.id).single();
      const stripeToken = stripeConn?.access_token || process.env.STRIPE_SECRET_KEY;
      if (stripeToken) {
        const stripe = new Stripe(stripeToken!, {
          apiVersion: "2026-02-25.clover",
        });

        const [charges, subscriptions, customers, balance] = await Promise.all([
          stripe.charges.list({ limit: 20 }),
          stripe.subscriptions.list({ limit: 20, status: "active" }),
          stripe.customers.list({ limit: 10 }),
          stripe.balance.retrieve(),
        ]);

        const totalRevenue = charges.data
          .filter(c => c.paid && !c.refunded)
          .reduce((sum, c) => sum + c.amount, 0) / 100;

        const mrr = subscriptions.data.reduce((sum, s) => {
          const item = s.items.data[0];
          if (!item?.price) return sum;
          const amount = (item.price.unit_amount || 0) / 100;
          if (item.price.recurring?.interval === "year") return sum + amount / 12;
          return sum + amount;
        }, 0);

        const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;

        const recentCharges = charges.data.slice(0, 10).map(c => ({
          amount: c.amount / 100,
          date: new Date(c.created * 1000).toLocaleDateString(),
          description: c.description || c.billing_details?.name || "Payment",
          status: c.paid ? "paid" : "failed",
        }));

        // Build monthly revenue from charges
        const monthlyMap: Record<string, number> = {};
        charges.data.forEach(c => {
          if (!c.paid) return;
          const month = new Date(c.created * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          monthlyMap[month] = (monthlyMap[month] || 0) + c.amount / 100;
        });
        const monthlyRevenue = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue }));

        stripeData = {
          totalRevenue,
          mrr,
          activeSubscriptions: subscriptions.data.length,
          totalCustomers: customers.data.length,
          availableBalance,
          recentCharges,
          monthlyRevenue,
        };

        connectedPlatforms.push("Stripe");
      }
    } catch {
      // Stripe failed
    }

    // Gmail
    try {
      const { data: gmailConn } = await supabase
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (gmailConn?.access_token) {
        let accessToken = gmailConn.access_token;

        if (new Date(gmailConn.token_expiry) < new Date()) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: gmailConn.refresh_token,
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            await supabase.from("gmail_connections").update({
              access_token: accessToken,
              token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            }).eq("user_id", user.id);
          }
        }

        const listRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const listData = await listRes.json();

        let unreadCount = 0;
        const recentEmails = [];

        if (listData.messages?.length) {
          const emails = await Promise.all(
            listData.messages.slice(0, 5).map(async (msg: { id: string }) => {
              const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              const msgData = await msgRes.json();
              const headers = msgData.payload?.headers || [];
              const subject = headers.find((h: {name: string}) => h.name === "Subject")?.value || "(No subject)";
              const from = headers.find((h: {name: string}) => h.name === "From")?.value || "Unknown";
              const date = headers.find((h: {name: string}) => h.name === "Date")?.value || "";
              const unread = msgData.labelIds?.includes("UNREAD") || false;
              if (unread) unreadCount++;
              return { from, subject, date: new Date(date).toLocaleDateString(), unread };
            })
          );
          recentEmails.push(...emails);
        }

        gmailData = {
          connected: true,
          email: gmailConn.email,
          unreadCount,
          recentEmails,
        };

        connectedPlatforms.push("Gmail");
      }
    } catch {
      // Gmail failed
    }

    return NextResponse.json({
      stripe: stripeData,
      gmail: gmailData,
      connectedPlatforms,
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
