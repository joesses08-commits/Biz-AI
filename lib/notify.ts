import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createNotification({
  user_id, type, title, body, link
}: { user_id: string; type: string; title: string; body: string; link?: string }) {
  await supabaseAdmin.from("notifications").insert({ user_id, type, title, body, link });
  
  // Send push notification if subscription exists
  try {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id);

    if (subs && subs.length > 0) {
      webpush.setVapidDetails(
        "mailto:joey@myjimmy.ai",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, link }));
        } catch {}
      }
    }
  } catch {}
}
