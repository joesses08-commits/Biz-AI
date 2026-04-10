// Simple in-memory rate limiter
// Limits requests per IP per time window

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt < now) store.delete(key);
    });
  }, 5 * 60 * 1000);
}

export function rateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Rate limit configs for different route types
export const RATE_LIMITS = {
  api: { maxRequests: 100, windowMs: 60 * 1000 },        // 100/min for general API
  auth: { maxRequests: 10, windowMs: 60 * 1000 },         // 10/min for auth routes
  ai: { maxRequests: 20, windowMs: 60 * 1000 },           // 20/min for AI routes
  webhook: { maxRequests: 200, windowMs: 60 * 1000 },     // 200/min for webhooks
};
