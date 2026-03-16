import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message });
  return NextResponse.json({ customers: data });
}

export async function POST(request: NextRequest) {
  const { name, email, company, plan } = await request.json();

  const { data, error } = await supabase.from("customers").insert({
    name,
    email,
    company,
    plan,
    status: "trial",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message });
  return NextResponse.json({ customer: data });
}

export async function PATCH(request: NextRequest) {
  const { customerId, status } = await request.json();

  const { error } = await supabase
    .from("customers")
    .update({ status })
    .eq("id", customerId);

  if (error) return NextResponse.json({ error: error.message });
  return NextResponse.json({ success: true });
}
