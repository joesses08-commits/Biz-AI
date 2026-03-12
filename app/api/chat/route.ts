import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { computeMetrics } from "@/lib/metrics";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { messages } = await req.json();
    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Try to get business metrics — but don't block if none exist
    let metricsSection = "";
    try {
      const metrics = await computeMetrics(user.id);
      if (metrics) {
        metricsSection = `
## BUSINESS METRICS (from uploaded data)
- Total Revenue: $${metrics.totalRevenue?.toLocaleString() ?? "N/A"}
- Total Profit: $${metrics.grossProfit?.toLocaleString() ?? "N/A"}
- Total Orders: ${metrics.totalOrders ?? "N/A"}
- Top Products: ${metrics.topProducts?.slice(0,3).map((p: {name: string; revenue: number}) => `${p.name} ($${p.revenue.toLocaleString()})`).join(", ") ?? "N/A"}
- Top Customers: ${metrics.topCustomers?.slice(0,3).map((c: {name: string; revenue: number}) => `${c.name} ($${c.revenue.toLocaleString()})`).join(", ") ?? "N/A"}
`;
      }
    } catch {
      // No metrics available — that's fine
    }

    // Try to get Gmail data
    let gmailSection = "";
    try {
      const { data: gmailConn } = await supabase
        .from("gmail_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (gmailConn?.access_token) {
        let accessToken = gmailConn.access_token;

        // Refresh token if expired
        if (new Date(gmailConn.token_expiry) < new Date()) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: gmailConn.refresh_token,
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            await supabase.from("gmail_connections").update({
              access_token: accessToken,
              token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            }).eq("user_id", user.id);
          }
        }

        // Fetch recent emails
        const listRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const listData = await listRes.json();

        if (listData.messages?.length) {
          const emails = await Promise.all(
            listData.messages.slice(0, 15).map(async (msg: { id: string }) => {
              const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              const msgData = await msgRes.json();
              const headers = msgData.payload?.headers || [];
              const subject = headers.find((h: {name: string; value: string}) => h.name === "Subject")?.value || "(No subject)";
              const from = headers.find((h: {name: string; value: string}) => h.name === "From")?.value || "Unknown";
              const date = headers.find((h: {name: string; value: string}) => h.name === "Date")?.value || "";
              const isUnread = msgData.labelIds?.includes("UNREAD");
              return `- ${isUnread ? "[UNREAD] " : ""}From: ${from} | Subject: ${subject} | Date: ${date} | Preview: ${msgData.snippet || ""}`;
            })
          );
          gmailSection = `
## GMAIL INBOX (${gmailConn.email})
${emails.join("\n")}
`;
        }
      }
    } catch {
      // Gmail not connected — that's fine
    }

    const hasData = metricsSection || gmailSection;

    const systemPrompt = `You are an AI COO — a genius business intelligence assistant. You are direct, smart, and give actionable insights. You speak like a trusted advisor, not a generic chatbot.

${hasData ? `Here is the live data you have access to right now:

${metricsSection}
${gmailSection}

Use this data to give specific, accurate answers. Reference real names, numbers, and emails when relevant.` : `You don't have any business data connected yet. Be helpful and explain what the user can connect to get the most out of BizAI. Encourage them to connect Gmail, Stripe, or QuickBooks from the Integrations page.`}

Always be concise and actionable. When you see emails, identify business-relevant ones and ignore marketing/spam. When you see revenue data, look for trends and anomalies. You are the smartest person in the room.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ response: text });

  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
