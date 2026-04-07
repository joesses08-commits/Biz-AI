import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/get-user";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);



export async function GET(req: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all factories with their max_samples
  const { data: factories } = await supabaseAdmin.from("factory_catalog").select("id, name, email, max_samples").eq("user_id", user.id).order("name");

  // Get all pending sample requests grouped by factory
  const { data: samples } = await supabaseAdmin
    .from("plm_sample_requests")
    .select("*, plm_products(id, name, sku, images, status, killed), factory_catalog(id, name)")
    .eq("user_id", user.id)
    .in("status", ["requested"])
    .neq("current_stage", "sample_shipped")
    .order("priority_order", { ascending: true, nullsFirst: false });

  // Filter out samples for products that are on hold or killed
  const filteredSamples = (samples || []).filter((s: any) => 
    !s.plm_products?.killed && s.plm_products?.status !== "hold"
  );

  return NextResponse.json({ factories: factories || [], samples: filteredSamples });
}

export async function POST(req: NextRequest) {
  const user = await getEffectiveUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "save_priorities") {
    const { factory_id, ordered_ids } = body;
    // Save priority_order for each sample in order
    for (let i = 0; i < ordered_ids.length; i++) {
      await supabaseAdmin.from("plm_sample_requests").update({ priority_order: i + 1 }).eq("id", ordered_ids[i]).eq("user_id", user.id);
    }
    // Clear priority for samples not in the list (unprioritized)
    const { data: allForFactory } = await supabaseAdmin.from("plm_sample_requests").select("id").eq("factory_id", factory_id).eq("user_id", user.id).in("status", ["requested"]).neq("current_stage", "sample_shipped");
    const unprioritized = (allForFactory || []).filter((s: any) => !ordered_ids.includes(s.id));
    for (const s of unprioritized) {
      await supabaseAdmin.from("plm_sample_requests").update({ priority_order: null }).eq("id", s.id);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "update_max_samples") {
    const { factory_id, max_samples } = body;
    await supabaseAdmin.from("factory_catalog").update({ max_samples }).eq("id", factory_id).eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
