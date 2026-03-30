import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function bustDashboardCache(userId: string) {
  try {
    await supabase
      .from("dashboard_cache")
      .delete()
      .eq("user_id", userId);
  } catch (err) {
    console.error("Cache bust error:", err);
  }
}
