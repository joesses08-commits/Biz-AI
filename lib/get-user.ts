import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getEffectiveUser(req?: import("next/server").NextRequest) {
  // Support internal calls with x-user-id header
  if (req) {
    const userId = req.headers.get("x-user-id");
    if (userId) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();
      if (profile) return { id: userId, email: "" } as any;
    }
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // If designer, use admin_user_id as effective user
  const { data: profile } = await supabaseAdmin.from("profiles")
    .select("is_designer, admin_user_id").eq("id", user.id).single();
  if (profile?.is_designer && profile?.admin_user_id) {
    return { ...user, id: profile.admin_user_id, _is_designer: true, _designer_id: user.id };
  }
  return user;
}
