import { getMemorySnapshot } from './process-guard.js';
import { logger } from './logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   HEALTH MONITOR
   Tracks runtime metrics for the bot process.
   Accessible via /admin status or logged on a schedule.
───────────────────────────────────────────────────────────────────────── */

const startedAt = Date.now();
let _interactionsProcessed = 0;
let _errorsTotal           = 0;
let _dbQueriesTotal        = 0;
let _lastInteractionAt     = 0;

export const Health = {
  recordInteraction() {
    _interactionsProcessed++;
    _lastInteractionAt = Date.now();
  },

  recordError() {
    _errorsTotal++;
  },

  recordDbQuery() {
    _dbQueriesTotal++;
  },

  getSnapshot() {
    const uptimeMs = Date.now() - startedAt;
    const mem      = getMemorySnapshot();
    const idleSec  = _lastInteractionAt
      ? Math.round((Date.now() - _lastInteractionAt) / 1000)
      : null;

    return {
      status:                 'ok',
      environment:            process.env.NODE_ENV ?? 'development',
      uptimeMs,
      uptimeHuman:            formatUptime(uptimeMs),
      startedAt:              new Date(startedAt).toISOString(),
      memory:                 mem,
      interactionsProcessed:  _interactionsProcessed,
      errorsTotal:            _errorsTotal,
      dbQueriesTotal:         _dbQueriesTotal,
      idleSecondsSinceLastInteraction: idleSec,
    };
  },

  logStatus() {
    const s = this.getSnapshot();
    logger.info(
      `[Health] uptime=${s.uptimeHuman} ` +
      `heap=${s.memory.heapMB}MB ` +
      `interactions=${s.interactionsProcessed} ` +
      `errors=${s.errorsTotal} ` +
      `env=${s.environment}`
    );
  },
};

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ── Periodic status log (every 30 minutes) ───────────────────────────── */
export function startHealthLogger(): void {
  const interval = setInterval(() => Health.logStatus(), 30 * 60 * 1000);
  interval.unref(); // Don't prevent process exit
}
