import { NextResponse } from "next/server";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildFullCompanyContext } from "@/lib/company-context";

const resend = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users?.users?.length) return NextResponse.json({ sent: 0 });

    let sent = 0;

    for (const user of users.users) {
      try {
        const email = user.email;
        if (!email) continue;

        const { data: profile } = await supabase
          .from("company_profiles")
          .select("company_name, company_brief")
          .eq("user_id", user.id)
          .single();

        const context = await buildFullCompanyContext(user.id);
        if (!context || context.length < 500) continue;

        const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: `You are an AI COO writing a daily morning briefing email. Today is ${today}.

Write a concise, punchy briefing with exactly this structure:
1. One sentence bottom line — the single most important thing happening right now
2. THREE items max — each with a specific dollar amount and one action
3. One opportunity they should act on today

Rules:
- Be specific — name customers, amounts, dates
- No fluff, no warm-up phrases
- Every point needs a dollar amount
- Cross-reference platforms to find non-obvious insights
- Keep it under 200 words total
- Format as clean HTML paragraphs, no markdown`,
          messages: [{ role: "user", content: context }],
        });

        const briefingText = response.content[0].type === "text" ? response.content[0].text : "";
        if (!briefingText) continue;

        const companyName = profile?.company_name || "Your Business";

        await resend.emails.send({
          from: "Jimmy AI <onboarding@resend.dev>",
          to: email,
          subject: `Your AI COO Briefing — ${today}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Jimmy AI</span>
                    <span style="color:#ffffff30;font-size:12px;margin-left:8px;">AI COO</span>
                  </td>
                  <td align="right">
                    <span style="color:#ffffff30;font-size:12px;">${today}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #ffffff10;">
              <p style="margin:0;color:#ffffff40;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Daily Briefing</p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-1px;line-height:1.2;">${companyName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0;">
              <div style="color:#ffffffb0;font-size:15px;line-height:1.7;">
                ${briefingText}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;padding-bottom:40px;border-top:1px solid #ffffff10;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td>
                    <a href="https://biz-ai-pi.vercel.app/dashboard" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;">
                      Open Command Center →
                    </a>
                    <a href="https://biz-ai-pi.vercel.app/chat" style="display:inline-block;background:transparent;color:#ffffff60;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;border:1px solid #ffffff15;margin-left:8px;">
                      Ask AI COO
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0;color:#ffffff20;font-size:11px;">
                Jimmy AI · AI Operating System for Business
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        });

        sent++;
      } catch (err) {
        console.error(`Failed to send briefing to ${user.email}:`, err);
        continue;
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
