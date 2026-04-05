import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPortalUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("factory_portal_users")
    .select("*")
    .eq("session_token", token)
    .eq("role", "designer")
    .single();
  if (!data) return null;
  if (new Date(data.session_expires_at) < new Date()) return null;
  return data;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const productId = formData.get("product_id") as string;

  if (!file || !productId) return NextResponse.json({ error: "Missing file or product_id" }, { status: 400 });

  // Verify product belongs to this owner
  const { data: product } = await supabaseAdmin
    .from("plm_products")
    .select("images, user_id")
    .eq("id", productId)
    .single();

  if (!product || product.user_id !== portalUser.user_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop();
  const path = `${portalUser.user_id}/${productId}/${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage.from("plm-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabaseAdmin.storage.from("plm-images").getPublicUrl(path);

  const images = product?.images || [];
  await supabaseAdmin.from("plm_products").update({ images: [...images, publicUrl] }).eq("id", productId);

  return NextResponse.json({ success: true, url: publicUrl });
}

export async function DELETE(req: NextRequest) {
  const portalUser = await getPortalUser(req);
  if (!portalUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, url } = await req.json();

  const { data: product } = await supabaseAdmin
    .from("plm_products")
    .select("images, user_id")
    .eq("id", product_id)
    .single();

  if (!product || product.user_id !== portalUser.user_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const images = (product?.images || []).filter((img: string) => img !== url);
  await supabaseAdmin.from("plm_products").update({ images }).eq("id", product_id);

  const path = url.split("/plm-images/")[1];
  if (path) await supabaseAdmin.storage.from("plm-images").remove([path]);

  return NextResponse.json({ success: true });
}
