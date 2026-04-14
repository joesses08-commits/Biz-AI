import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: collection } = await supabaseAdmin
    .from("plm_collections")
    .select("*, plm_products(id, name, sku, images, action_status, action_note, status, killed, notes, factory_notes, plm_factory_tracks(id, factory_id, status, approved_price, factory_catalog(id, name), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number)))")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ collection });
}
