/* ─────────────────────────────────────────────────────────────────────────
   INTERACTION DEDUPLICATION GUARD
   Prevents double-processing the same Discord interaction ID.
   Interactions expire from the set after 10 seconds (Discord's ACK window).
───────────────────────────────────────────────────────────────────────── */

const TTL_MS = 10_000;
const _seen  = new Map<string, number>(); // id → expiry timestamp

// Prune expired entries every 60 seconds
const pruner = setInterval(() => {
  const now = Date.now();
  for (const [id, expiry] of _seen) {
    if (now > expiry) _seen.delete(id);
  }
}, 60_000);
pruner.unref();

export const InteractionGuard = {
  /**
   * Returns true if this interaction ID has NOT been seen before.
   * Marks it as seen on first call.
   */
  tryAcquire(interactionId: string): boolean {
    const now = Date.now();
    const expiry = _seen.get(interactionId);
    if (expiry && now < expiry) return false; // already processing
    _seen.set(interactionId, now + TTL_MS);
    return true;
  },

  /** Force-release an interaction ID (e.g. after an error that needs a retry). */
  release(interactionId: string): void {
    _seen.delete(interactionId);
  },

  /** Current count of tracked in-flight interactions. */
  size(): number {
    return _seen.size;
  },
};
