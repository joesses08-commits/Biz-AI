import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Token costs per feature (in tokens)
// $0.001 per token, so 1000 tokens = $1
export const TOKEN_COSTS = {
  dashboard: 150,      // ~15 cents
  chat: 30,            // ~3 cents
  snapshot: 100,       // ~10 cents
  briefing: 20,        // ~2 cents
  event_processor: 3,  // ~0.3 cents
  backfill: 0,         // FREE — brain build never costs tokens
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
    // Create quota for new user
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

  // Reset daily counter if new day
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

  // Free features always allowed
  if (cost === 0) return { allowed: true, tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };

  // Check monthly limit
  if (quota.tokens_remaining < cost) {
    return { allowed: false, reason: "monthly_limit", tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
  }

  // Check daily limit (soft limit)
  if (quota.daily_limit && quota.tokens_used_today + cost > quota.daily_limit) {
    return { allowed: false, reason: "daily_limit", tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
  }

  return { allowed: true, tokensRemaining: quota.tokens_remaining, tokensUsedToday: quota.tokens_used_today, dailyLimit: quota.daily_limit };
}

export async function consumeTokens(userId: string, feature: keyof typeof TOKEN_COSTS) {
  const cost = TOKEN_COSTS[feature];
  if (cost === 0) return; // Free features don't consume tokens

  await supabaseAdmin.from("user_quota").update({
    tokens_remaining: supabaseAdmin.rpc ? undefined : undefined, // use raw update
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Use raw SQL for atomic decrement
  await supabaseAdmin.rpc("decrement_tokens", {
    p_user_id: userId,
    p_cost: cost,
  }).catch(async () => {
    // Fallback if RPC doesn't exist
    const quota = await getQuota(userId);
    if (quota) {
      await supabaseAdmin.from("user_quota").update({
        tokens_remaining: Math.max(0, quota.tokens_remaining - cost),
        tokens_used_today: quota.tokens_used_today + cost,
        monthly_total_used: quota.monthly_total_used + cost,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    }
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
