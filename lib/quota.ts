import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const TOKEN_COSTS = {
  dashboard: 150,
  chat: 30,
  snapshot: 100,
  briefing: 20,
  event_processor: 3,
  backfill: 0,
};

export const MONTHLY_TOKENS = 50000;
export const TOKENS_PER_DOLLAR = 1000;

export async function getQuota(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  let { data: quota } = await supabaseAdmin
    .from("user_quota")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!quota) {
    const { data: newQuota } = await supabaseAdmin
      .from("user_quota")
      .insert({
        user_id: userId,
        tokens_remaining: MONTHLY_TOKENS,
        tokens_used_today: 0,
        daily_limit: null,
        monthly_total_used: 0,
        last_reset_date: today,
        last_daily_reset: today,
      })
      .select()
      .single();
    return newQuota;
  }

  if (quota.last_daily_reset !== today) {
    const { data: updated } = await supabaseAdmin
      .from("user_quota")
      .update({
        tokens_used_today: 0,
        last_daily_reset: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();
    return updated;
  }

  return quota;
}

export async function checkQuota(userId: string, feature: keyof typeof TOKEN_COSTS): Promise<{
  allowed: boolean;
  reason?: "monthly_limit" | "daily_limit";
  tokensRemaining: number;
  tokensUsedToday: number;
  dailyLimit: number | null;
}> {
  const quota = await getQuota(userId);
  if (!quota) return { allowed: true, tokensRemaining: MONTHLY_TOKENS, tokensUsedToday: 0, dailyLimit: null };

  const cost = TOKEN_COSTS[feature];

  if (cost === 0) return { allowed: true, tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };

  if (quota.tokens_remaining < cost) {
    return { allowed: false, reason: "monthly_limit", tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
  }

  if (quota.daily_limit && quota.tokens_used_today + cost > quota.daily_limit) {
    return { allowed: false, reason: "daily_limit", tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
  }

  return { allowed: true, tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
}

export async function consumeTokens(userId: string, feature: keyof typeof TOKEN_COSTS) {
  const cost = TOKEN_COSTS[feature];
  if (cost === 0) return;

  await supabaseAdmin.rpc("decrement_tokens", {
    p_user_id: userId,
    p_cost: cost,
  });
}

export async function addTokens(userId: string, tokens: number) {
  const quota = await getQuota(userId);
  if (!quota) return;

  await supabaseAdmin.from("user_quota").update({
    tokens_remaining: quota.tokens_remaining + tokens,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}
