import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFullCompanyContext } from "@/lib/company-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const companyContext = await buildFullCompanyContext(user.id);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: `You are a business intelligence engine. Based on the company data provided, return ONLY a valid JSON object with no markdown, no explanation, no backticks — just raw JSON.

Analyze the business and return the most relevant metrics. The metric types depend on the business:
- SaaS/subscriptions → MRR, churn, ARR, active subscribers
- Wholesale/product → orders, units sold, avg order value, top products  
- Services → invoiced, collected, outstanding, utilization
- Ecommerce → GMV, conversion, AOV, repeat customers
- Any business → cash position, top customers, recent activity, alerts

Return this exact JSON structure:
{
  "business_type": "string describing the business",
  "briefing": "2 sentence executive briefing on the most important things right now",
  "alerts": ["array of up to 3 urgent items needing attention — only include if genuinely urgent"],
  "metrics": [
    {
      "id": "unique_id",
      "label": "Metric Name",
      "value": "formatted value like $12,400 or 47 or 23%",
      "sub": "short context like 'this month' or 'vs last month +12%'",
      "trend": "up | down | neutral",
      "category": "revenue | operations | customers | cash | activity"
    }
  ],
  "top_items": [
    {
      "type": "customer | product | invoice | email | transaction",
      "label": "name or description",
      "value": "dollar amount or status",
      "status": "good | warning | urgent | neutral"
    }
  ],
  "chart_data": [
    { "label": "month or period", "value": number }
  ],
  "chart_label": "what the chart shows e.g. Monthly Revenue"
}

Only include metrics that have real data. Do not make up numbers. If a metric has no data, omit it.`,
      messages: [{ role: "user", content: companyContext || "No integrations connected yet." }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { briefing: text, metrics: [], top_items: [], alerts: [] };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
