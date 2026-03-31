import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createSubscription(token: string, userId: string) {
  const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/microsoft/push`,
      resource: "me/mailFolders('Inbox')/messages",
      expirationDateTime,
      clientState: userId,
    }),
  });

  const data = await res.json();
  return data;
}

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

    const { data: conn } = await supabaseAdmin
      .from("microsoft_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conn) return NextResponse.json({ error: "Microsoft not connected" }, { status: 400 });

    const subscription = await createSubscription(conn.access_token, user.id);

    if (!subscription.id) {
      return NextResponse.json({ error: "Failed to create subscription", details: subscription }, { status: 500 });
    }

    await supabaseAdmin.from("microsoft_connections").update({
      subscription_id: subscription.id,
      subscription_expires_at: subscription.expirationDateTime,
    }).eq("user_id", user.id);

    return NextResponse.json({ success: true, subscriptionId: subscription.id, expires: subscription.expirationDateTime });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Cron route — renews all expiring subscriptions
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find subscriptions expiring in next 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: expiring } = await supabaseAdmin
      .from("microsoft_connections")
      .select("*")
      .lt("subscription_expires_at", tomorrow)
      .not("subscription_id", "is", null);

    if (!expiring?.length) return NextResponse.json({ renewed: 0 });

    let renewed = 0;
    for (const conn of expiring) {
      try {
        // Renew subscription
        const newExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${conn.subscription_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${conn.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expirationDateTime: newExpiry }),
        });

        const data = await res.json();
        if (data.id) {
          await supabaseAdmin.from("microsoft_connections").update({
            subscription_expires_at: data.expirationDateTime,
          }).eq("user_id", conn.user_id);
          renewed++;
        }
      } catch { continue; }
    }

    return NextResponse.json({ renewed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
