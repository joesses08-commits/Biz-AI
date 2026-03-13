import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { buildSystemPrompt } from "@/lib/prompt";
import { getBusinessMetrics } from "@/lib/metrics";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function getQuickBooksData(userId: string) {
  try {
    const supabase = createServerClient();
    const { data: conn } = await supabase
      .from("quickbooks_connections")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!conn) return null;

    const baseUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${conn.realm_id}`;
    const headers = {
      Authorization: `Bearer ${conn.access_token}`,
      Accept: "application/json",
    };

    const invoiceRes = await fetch(
      `${baseUrl}/query?query=SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS 10`,
      { headers }
    );
    const invoiceData = await invoiceRes.json();
    const invoices = invoiceData?.QueryResponse?.Invoice || [];
    const unpaid = invoices.filter((inv: any) => inv.Balance > 0);
    const totalUnpaid = unpaid.reduce((sum: number, inv: any) => sum + inv.Balance, 0);

    return { invoices, totalUnpaid, unpaidCount: unpaid.length };
  } catch {
    return null;
  }
}

async function getStripeData(userId: string) {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("stripe_connections")
      .select("*")
      .eq("user_id", userId)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  const userId = "demo-user";

  const metrics = await getBusinessMetrics(userId);
  const systemPrompt = buildSystemPrompt(metrics);

  const [stripeData, qbData] = await Promise.all([
    getStripeData(userId),
    getQuickBooksData(userId),
  ]);

  let extraContext = "";

  if (stripeData) {
    extraContext += `\nSTRIPE PAYMENTS\n- Connected: yes\n- Account: ${stripeData.stripe_user_id}\n`;
  }

  if (qbData) {
    extraContext += `\nQUICKBOOKS FINANCIALS\n- Total unpaid invoices: $${qbData.totalUnpaid.toLocaleString()}\n- Number of unpaid invoices: ${qbData.unpaidCount}\n`;
    if (qbData.invoices.length > 0) {
      extraContext += `- Recent invoices:\n`;
      qbData.invoices.slice(0, 5).forEach((inv: any) => {
        extraContext += `  • ${inv.CustomerRef?.name} — $${inv.TotalAmt} (${inv.Balance > 0 ? `$${inv.Balance} due` : "paid"})\n`;
      });
    }
  }

  const fullSystemPrompt = systemPrompt + extraContext;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: fullSystemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ message: text });
}
