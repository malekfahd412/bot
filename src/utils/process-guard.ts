import { logger } from './logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   PROCESS GUARD
   - Global uncaughtException / unhandledRejection handlers
   - SIGTERM / SIGINT graceful shutdown
   - Memory watchdog (warns before OOM, never forces crash)
───────────────────────────────────────────────────────────────────────── */

const MEMORY_WARN_MB  = 400;
const MEMORY_CHECK_MS = 5 * 60 * 1000; // every 5 minutes

let _shutdownCallbacks: Array<() => Promise<void> | void> = [];
let _shuttingDown = false;

export function registerShutdownCallback(cb: () => Promise<void> | void): void {
  _shutdownCallbacks.push(cb);
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (_shuttingDown) return;
  _shuttingDown = true;

  logger.warn(`[ProcessGuard] Received ${signal} — starting graceful shutdown`);

  for (const cb of _shutdownCallbacks) {
    try {
      await Promise.resolve(cb());
    } catch (err) {
      logger.error('[ProcessGuard] Shutdown callback error:', err);
    }
  }

  logger.info('[ProcessGuard] Shutdown complete. Exiting.');
  process.exit(0);
}

export function installProcessGuard(): void {
  // ── Unhandled promise rejections ──────────────────────────────────────
  process.on('unhandledRejection', (reason, promise) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    logger.error('[ProcessGuard] Unhandled promise rejection:', msg);
    if (reason instanceof Error && reason.stack) {
      logger.error('[ProcessGuard] Stack:', reason.stack);
    }
    // Do NOT exit — keep the bot alive
  });

  // ── Uncaught synchronous exceptions ───────────────────────────────────
  process.on('uncaughtException', (err: Error) => {
    logger.error('[ProcessGuard] Uncaught exception:', err.message);
    if (err.stack) logger.error('[ProcessGuard] Stack:', err.stack);

    // For truly fatal errors (e.g. ENOMEM) we must exit, but give it a moment
    // to flush logs. Most runtime errors should NOT reach here with good try/catch.
    if (isFatalError(err)) {
      logger.error('[ProcessGuard] Fatal error — process will restart.');
      setTimeout(() => process.exit(1), 500);
    }
    // Otherwise stay alive
  });

  // ── Graceful shutdown on signals ──────────────────────────────────────
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  // ── Memory watchdog ───────────────────────────────────────────────────
  const memWatchdog = setInterval(() => {
    try {
      const used = process.memoryUsage();
      const heapMB = Math.round(used.heapUsed / 1024 / 1024);
      const rssMB  = Math.round(used.rss       / 1024 / 1024);

      if (heapMB > MEMORY_WARN_MB) {
        logger.warn(`[ProcessGuard] High memory usage — heap: ${heapMB} MB, rss: ${rssMB} MB`);
        // Suggest GC if available (Node --expose-gc)
        if (typeof (global as unknown as Record<string, unknown>).gc === 'function') {
          (global as unknown as Record<string, () => void>).gc();
          logger.info('[ProcessGuard] Manual GC triggered');
        }
      } else {
        logger.debug(`[ProcessGuard] Memory OK — heap: ${heapMB} MB, rss: ${rssMB} MB`);
      }
    } catch { /* watchdog must never throw */ }
  }, MEMORY_CHECK_MS);

  // Don't keep the process alive just for the watchdog
  memWatchdog.unref();

  logger.info('[ProcessGuard] Process guard installed');
}

function isFatalError(err: Error): boolean {
  const FATAL_CODES = ['ENOMEM', 'ENOSPC', 'ERR_OUT_OF_RANGE'];
  const code = (err as NodeJS.ErrnoException).code;
  return !!(code && FATAL_CODES.includes(code));
}

/* ─── Health snapshot (callable from admin commands) ───────────────────── */

export function getMemorySnapshot(): { heapMB: number; rssMB: number; externalMB: number } {
  const m = process.memoryUsage();
  return {
    heapMB:     Math.round(m.heapUsed  / 1024 / 1024),
    rssMB:      Math.round(m.rss       / 1024 / 1024),
    externalMB: Math.round(m.external  / 1024 / 1024),
  };
}
