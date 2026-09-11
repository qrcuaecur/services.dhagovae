import "server-only";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(key: string): void;
}

/**
 * Sliding-window limiter held in process memory.
 *
 * This only throttles a single long-lived Node process. Behind multiple
 * instances or serverless functions each instance keeps its own counters, so
 * the effective limit multiplies. Swapping in a shared store (Upstash/Redis)
 * means reimplementing this interface and nothing else.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = Date.now();

  function sweep(now: number) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, timestamps] of hits) {
      const live = timestamps.filter((t) => now - t < windowMs);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);

      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= limit) {
        const oldest = recent[0];
        hits.set(key, recent);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
        };
      }

      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },

    reset(key: string) {
      hits.delete(key);
    },
  };
}

export const loginRateLimiter = createRateLimiter({ limit: 5, windowMs: 5 * 60 * 1000 });

export const downloadRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

/**
 * Best-effort client address. Proxy headers are spoofable, so this is a
 * throttling heuristic, never an identity or an access decision.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
