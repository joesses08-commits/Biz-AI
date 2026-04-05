import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const productId = formData.get("product_id") as string;

  if (!file || !productId) return NextResponse.json({ error: "Missing file or product_id" }, { status: 400 });

  const ext = file.name.split(".").pop();
  const path = `${user.id}/${productId}/${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage.from("plm-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabaseAdmin.storage.from("plm-images").getPublicUrl(path);

  // Add URL to product images array
  const { data: product } = await supabaseAdmin.from("plm_products").select("images").eq("id", productId).single();
  const images = product?.images || [];
  await supabaseAdmin.from("plm_products").update({ images: [...images, publicUrl] }).eq("id", productId);

  return NextResponse.json({ success: true, url: publicUrl });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, url } = await req.json();

  // Remove from images array
  const { data: product } = await supabaseAdmin.from("plm_products").select("images").eq("id", product_id).single();
  const images = (product?.images || []).filter((img: string) => img !== url);
  await supabaseAdmin.from("plm_products").update({ images }).eq("id", product_id);

  // Delete from storage
  const path = url.split("/plm-images/")[1];
  if (path) await supabaseAdmin.storage.from("plm-images").remove([path]);

  return NextResponse.json({ success: true });
}
