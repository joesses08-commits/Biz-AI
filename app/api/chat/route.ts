import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/prompt";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function getMicrosoftExcelData() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", "demo-user").single();
    if (!conn) return null;

    const headers = { Authorization: `Bearer ${conn.access_token}` };

    const filesRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50&$select=id,name,file",
      { headers }
    );
    const filesData = await filesRes.json();
    const excelFiles = (filesData.value || []).filter((f: any) =>
      f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls")
    );

    if (excelFiles.length === 0) return null;

    let excelContext = "";

    for (const file of excelFiles.slice(0, 3)) {
      try {
        const sessionRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/createSession`,
          { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ persistChanges: false }) }
        );
        const session = await sessionRes.json();
        const sessionHeaders = { ...headers, "workbook-session-id": session.id || "" };

        const sheetsRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets`,
          { headers: sessionHeaders }
        );
        const sheetsData = await sheetsRes.json();
        if (!sheetsData.value?.length) continue;

        const sheetName = encodeURIComponent(sheetsData.value[0].name);
        const rangeRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook/worksheets/${sheetName}/usedRange`,
          { headers: sessionHeaders }
        );
        const rangeData = await rangeRes.json();
        const values = rangeData.values || [];

        if (values.length > 0) {
          excelContext += `\nEXCEL FILE: ${file.name}\n`;
          values.slice(0, 20).forEach((row: any[]) => {
            excelContext += row.join(" | ") + "\n";
          });
        }
      } catch {
        continue;
      }
    }

    return excelContext || null;
  } catch {
    return null;
  }
}

async function getStripeData(userId: string) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await supabase.from("stripe_connections").select("stripe_user_id").eq("user_id", userId).single();
    return data || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  const userId = "demo-user";

  const [stripeConn, excelData] = await Promise.all([
    getStripeData(userId),
    getMicrosoftExcelData(),
  ]);

  let systemPrompt = `You are the AI COO of this business. You report directly to the CEO.

Your communication style:
- Lead with the single most important insight — always first, no warm-up
- Give one clear, specific recommendation
- Be direct and confident. No hedging, no filler
- Keep responses under 5 sentences UNLESS the CEO asks to go deeper
- Always end with: "Want me to go deeper on this?"

Never say: "Great question", "Certainly", "Based on the data provided", or any warm-up phrase.

Default response format:
**Bottom line:** [one sentence — the most critical thing happening right now]
**Recommendation:** [one specific action to take]
Want me to go deeper on this?`;

  if (stripeConn) {
    systemPrompt += `\n\nSTRIPE: Connected (account: ${stripeConn.stripe_user_id})`;
  }

  if (excelData) {
    systemPrompt += `\n\nLIVE EXCEL DATA FROM ONEDRIVE:\n${excelData}`;
  }

  if (!stripeConn && !excelData) {
    systemPrompt += `\n\nNo business data connected yet. Tell the CEO to connect their integrations at /integrations.`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ message: text });
}
