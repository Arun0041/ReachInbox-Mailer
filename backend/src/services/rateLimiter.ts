import type { EmailRow } from "../db/pool.js";

/**
 * Redis-backed, per-sender hourly rate limiter.
 *
 * Counter key: ratelimit:{from_email}:{UTC hour window}. Safe across
 * multiple workers/instances because the count lives in Redis, not memory.
 * When the limit is hit the caller is told to defer the job to the start of
 * the next window — jobs are delayed, never dropped or failed.
 */
const WINDOW_MS = 60 * 60 * 1000;

export function currentWindowStart(now = Date.now()): number {
  return Math.floor(now / WINDOW_MS) * WINDOW_MS;
}

export function windowKey(sender: string, windowStart: number): string {
  return `ratelimit:${sender}:${windowStart}`;
}

export interface RateDecision {
  allowed: boolean;
  /** Milliseconds until the next hour window opens (when not allowed). */
  retryAfterMs: number;
}

export async function checkRateLimit(
  redis: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown>; decr: (k: string) => Promise<unknown> },
  sender: string,
  effectiveLimit: number,
  now = Date.now(),
): Promise<RateDecision> {
  const windowStart = currentWindowStart(now);
  const key = windowKey(sender, windowStart);
  const count = await redis.incr(key);
  await redis.expire(key, 7200);

  if (count > effectiveLimit) {
    // Undo the reservation so this job's retry doesn't double-count.
    await redis.decr(key);
    const nextWindow = windowStart + WINDOW_MS;
    return { allowed: false, retryAfterMs: Math.max(1000, nextWindow - now) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function effectiveLimit(
  envLimit: number,
  email: Pick<EmailRow, "hourly_limit">,
): number {
  // A batch may tighten the system-wide cap, never raise it.
  if (email.hourly_limit && email.hourly_limit > 0) {
    return Math.min(envLimit, email.hourly_limit);
  }
  return envLimit;
}
