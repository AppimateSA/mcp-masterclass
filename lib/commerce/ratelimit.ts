import type { Plan } from "./plans";
import { store } from "./store";

/**
 * Fixed-window rate limits per customer: a per-minute burst limit and a
 * per-day quota. The key is the customer id from the verified token, never an
 * IP address (many users share an IP behind mobile carriers and campus NAT).
 */
export interface LimitResult {
  allowed: boolean;
  limit: "minute" | "day" | null;
  remainingToday: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(customerId: string, plan: Plan, now = new Date()): Promise<LimitResult> {
  const minuteWindow = Math.floor(now.getTime() / 60_000);
  const day = now.toISOString().slice(0, 10);

  const perMinute = await store.incr(`rl:${customerId}:m:${minuteWindow}`, 1, 120);
  const perDay = await store.incr(`rl:${customerId}:d:${day}`, 1, 60 * 60 * 48);

  if (perMinute > plan.perMinute) {
    return { allowed: false, limit: "minute", remainingToday: Math.max(0, plan.perDay - perDay), retryAfterSeconds: 60 - now.getUTCSeconds() };
  }
  if (perDay > plan.perDay) {
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return { allowed: false, limit: "day", remainingToday: 0, retryAfterSeconds: Math.ceil((midnight - now.getTime()) / 1000) };
  }
  return { allowed: true, limit: null, remainingToday: plan.perDay - perDay, retryAfterSeconds: 0 };
}
