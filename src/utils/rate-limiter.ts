/* ─────────────────────────────────────────────────────────────────────────
   INTERACTION RATE LIMITER
   Per-user, per-action sliding-window rate limiter.
   No external dependencies — pure in-memory Map.

   Usage:
     const ok = RateLimiter.check(userId, 'shop_buy', 5, 10_000); // 5 hits / 10 s
     if (!ok) { ... reply cooldown ... return; }
───────────────────────────────────────────────────────────────────────── */

interface Bucket {
  hits: number;
  windowStart: number;
}

const _buckets = new Map<string, Bucket>();

// Prune stale entries every 5 minutes
const _pruner = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _buckets) {
    if (now - bucket.windowStart > 120_000) _buckets.delete(key);
  }
}, 5 * 60_000);
_pruner.unref();

export const RateLimiter = {
  /**
   * Returns true if the action is allowed, false if the user is rate-limited.
   * @param userId   Discord user ID
   * @param action   Scoping key for the action (e.g. 'shop_buy', 'daily')
   * @param maxHits  Max allowed hits within the window
   * @param windowMs Time window in milliseconds (default 3 s)
   */
  check(userId: string, action: string, maxHits = 5, windowMs = 3_000): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const bucket = _buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      _buckets.set(key, { hits: 1, windowStart: now });
      return true;
    }

    if (bucket.hits >= maxHits) return false;
    bucket.hits++;
    return true;
  },

  /** Remaining cool-down ms for a user/action (0 if not limited). */
  remaining(userId: string, action: string, windowMs = 3_000): number {
    const key = `${userId}:${action}`;
    const bucket = _buckets.get(key);
    if (!bucket) return 0;
    const elapsed = Date.now() - bucket.windowStart;
    return elapsed >= windowMs ? 0 : windowMs - elapsed;
  },

  /** Hard reset a user's bucket (e.g. after a confirmed purchase). */
  reset(userId: string, action: string): void {
    _buckets.delete(`${userId}:${action}`);
  },

  /** Current number of tracked buckets (diagnostic). */
  size(): number {
    return _buckets.size;
  },
};
