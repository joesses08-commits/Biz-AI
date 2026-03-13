import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { buildSystemPrompt } from "@/lib/prompt";
import { computeMetrics } from "@/lib/metrics";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  const userId = "demo-user";

  const supabase = createServerClient();

  const [metrics, qbConn, stripeConn] = await Promise.all([
    computeMetrics(userId),
    supabase.from("quickbooks_connections").select("access_token,realm_id").eq("user_id", userId).single(),
    supabase.from("stripe_connections").select("stripe_user_id").eq("user_id", userId).single(),
  ]);

  if (!metrics) {
    return NextResponse.json({ message: "Unable to load business data." });
  }

  let extraContext = "";

  if (stripeConn.data) {
    extraContext += `\nSTRIPE: Connected (account: ${stripeConn.data.stripe_user_id})\n`;
  }

  if (qbConn.data) {
    try {
      const baseUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${qbConn.data.realm_id}`;
      const invoiceRes = await fetch(
        `${baseUrl}/query?query=SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 5`,
        { headers: { Authorization: `Bearer ${qbConn.data.access_token}`, Accept: "application/json" } }
      );
      const invoiceData = await invoiceRes.json();
      const invoices = invoiceData?.QueryResponse?.Invoice || [];
      const totalUnpaid = invoices.reduce((sum: number, inv: any) => sum + inv.Balance, 0);

      extraContext += `\nQUICKBOOKS: Connected\n- Unpaid invoices: ${invoices.length} totaling $${totalUnpaid.toLocaleString()}\n`;
      invoices.forEach((inv: any) => {
        extraContext += `  • ${inv.CustomerRef?.name} — $${inv.Balance} due\n`;
      });
    } catch {
      extraContext += `\nQUICKBOOKS: Connected\n`;
    }
  }

  const systemPrompt = buildSystemPrompt(metrics) + extraContext;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ message: text });
}
