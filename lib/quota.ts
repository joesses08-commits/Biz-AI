import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const MONTHLY_TOKENS = 50000;

// Token costs per feature — shown on quota page
export const TOKEN_COSTS = {
  dashboard: 150,
  chat: 30,
  snapshot: 100,
  briefing: 20,
  event_processor: 3,
  backfill: 0,
};

// Get start of current billing period (1st of current month)
function getBillingPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Get start of today
function getTodayStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function getQuota(userId: string) {
  const billingStart = getBillingPeriodStart();
  const todayStart = getTodayStart();

  // Get total tokens used this billing period from api_usage
  const { data: monthlyUsage } = await supabaseAdmin
    .from("api_usage")
    .select("input_tokens, output_tokens, model")
    .eq("user_id", userId)
    .gte("created_at", billingStart);

  // Convert real API tokens to quota tokens using cost ($0.001 per quota token)
  const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-5": { input: 0.000003, output: 0.000015 },
    "claude-haiku-4-5-20251001": { input: 0.00000025, output: 0.00000125 },
  };

  const tokensUsedThisMonth = Math.round((monthlyUsage || []).reduce((sum, r) => {
    const costs = MODEL_COSTS[r.model] || MODEL_COSTS["claude-sonnet-4-5"];
    const costUsd = (r.input_tokens || 0) * costs.input + (r.output_tokens || 0) * costs.output;
    return sum + (costUsd / 0.001); // 1 quota token = $0.001
  }, 0));

  // Get tokens used today
  const { data: todayUsage } = await supabaseAdmin
    .from("api_usage")
    .select("input_tokens, output_tokens, model")
    .eq("user_id", userId)
    .gte("created_at", todayStart);

  const tokensUsedToday = Math.round((todayUsage || []).reduce((sum, r) => {
    const costs = MODEL_COSTS[r.model] || MODEL_COSTS["claude-sonnet-4-5"];
    const costUsd = (r.input_tokens || 0) * costs.input + (r.output_tokens || 0) * costs.output;
    return sum + (costUsd / 0.001);
  }, 0));

  // Get bonus tokens from purchases
  const { data: quotaRow } = await supabaseAdmin
    .from("user_quota")
    .select("tokens_remaining, daily_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const bonusTokens = quotaRow?.tokens_remaining || 0;
  const dailyLimit = quotaRow?.daily_limit || null;

  const totalAllowance = MONTHLY_TOKENS + bonusTokens;
  const tokensRemaining = Math.max(0, totalAllowance - tokensUsedThisMonth);

  return {
    tokensRemaining,
    tokensUsedToday,
    monthlyTotalUsed: tokensUsedThisMonth,
    dailyLimit,
    monthlyLimit: totalAllowance,
    pctUsed: Math.round((tokensUsedThisMonth / totalAllowance) * 100),
  };
}

export async function checkQuota(userId: string, feature: keyof typeof TOKEN_COSTS): Promise<{
  allowed: boolean;
  reason?: "monthly_limit" | "daily_limit";
  tokensRemaining: number;
  tokensUsedToday: number;
  dailyLimit: number | null;
}> {
  const quota = await getQuota(userId);
  const cost = TOKEN_COSTS[feature];

  if (cost === 0) return { allowed: true, tokensRemaining: quota.tokensRemaining, tokensUsedToday: quota.tokensUsedToday, dailyLimit: quota.dailyLimit };

  if (quota.tokensRemaining < cost) {
    return { allowed: false, reason: "monthly_limit", tokensRemaining: quota.tokensRemaining, tokensUsedToday: quota.tokensUsedToday, dailyLimit: quota.dailyLimit };
  }

  if (quota.dailyLimit && quota.tokensUsedToday + cost > quota.dailyLimit) {
    return { allowed: false, reason: "daily_limit", tokensRemaining: quota.tokensRemaining, tokensUsedToday: quota.tokensUsedToday, dailyLimit: quota.dailyLimit };
  }

  return { allowed: true, tokensRemaining: quota.tokensRemaining, tokensUsedToday: quota.tokensUsedToday, dailyLimit: quota.dailyLimit };
}

// No longer needed — usage is tracked via api_usage automatically
export async function consumeTokens(userId: string, feature: keyof typeof TOKEN_COSTS) {
  // Usage is now calculated from api_usage table — no separate counter needed
  return;
}

export async function addTokens(userId: string, tokens: number) {
  // Add bonus tokens from purchase to user_quota
  const { data: existing } = await supabaseAdmin
    .from("user_quota")
    .select("tokens_remaining")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("user_quota").update({
      tokens_remaining: (existing.tokens_remaining || 0) + tokens,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    await supabaseAdmin.from("user_quota").insert({
      user_id: userId,
      tokens_remaining: tokens,
      daily_limit: null,
    });
  }
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}
