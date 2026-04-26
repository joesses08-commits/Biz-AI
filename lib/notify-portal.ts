import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createPortalNotification({
  portal_user_id, type, title, body, link
}: { portal_user_id: string; type: string; title: string; body: string; link?: string }) {
  try {
    await supabaseAdmin.from("portal_notifications").insert({ portal_user_id, type, title, body, link: link || null });
  } catch {}
}
