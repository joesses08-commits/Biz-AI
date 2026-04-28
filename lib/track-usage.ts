import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 0.000003, output: 0.000015 },
  "claude-haiku-4-5-20251001": { input: 0.00000025, output: 0.00000125 },
};

export async function trackUsage(
  userId: string,
  feature: string,
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    const costs = MODEL_COSTS[model] || { input: 0.000003, output: 0.000015 };
    const costUsd = (inputTokens * costs.input) + (outputTokens * costs.output);

    await supabase.from("api_usage").insert({
      user_id: userId,
      feature,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });
  } catch (err) {
    console.error("Usage tracking error:", err);
  }
}

export async function getUserUsageSummary(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("api_usage")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo);

  if (!data?.length) return { totalCost: 0, totalCalls: 0, byFeature: {} };

  const totalCost = data.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  const totalCalls = data.length;

  const byFeature: Record<string, { calls: number; cost: number }> = {};
  for (const row of data) {
    if (!byFeature[row.feature]) byFeature[row.feature] = { calls: 0, cost: 0 };
    byFeature[row.feature].calls++;
    byFeature[row.feature].cost += row.cost_usd || 0;
  }

  return { totalCost, totalCalls, byFeature };
}
