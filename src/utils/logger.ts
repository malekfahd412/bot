import { appendFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

/* ─────────────────────────────────────────────────────────────────────────
   PRODUCTION LOGGER
   - Colored console output with timestamps
   - File logging to logs/ directory
   - Log rotation: keeps last 7 daily files, max 10 MB per file
───────────────────────────────────────────────────────────────────────── */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const LOG_DIR = join(process.cwd(), 'logs');
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES  = 7;

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

function currentLogPath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return join(LOG_DIR, `bot-${date}.log`);
}

function rotateLogs(): void {
  try {
    ensureLogDir();
    const files = readdirSync(LOG_DIR)
      .filter(f => f.startsWith('bot-') && f.endsWith('.log'))
      .map(f => ({ name: f, path: join(LOG_DIR, f), mtime: statSync(join(LOG_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    for (let i = MAX_LOG_FILES; i < files.length; i++) {
      try { unlinkSync(files[i].path); } catch { /* ignore */ }
    }
  } catch { /* rotation is non-fatal */ }
}

function writeToFile(line: string): void {
  try {
    ensureLogDir();
    const path = currentLogPath();

    // Rotate if file is too large
    if (existsSync(path) && statSync(path).size > MAX_FILE_BYTES) {
      rotateLogs();
    }

    // Strip ANSI color codes for file output
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
    appendFileSync(path, clean + '\n', 'utf-8');
  } catch { /* file logging is non-fatal — never crash on log write */ }
}

// Run rotation check once at startup (non-blocking)
setImmediate(() => { try { rotateLogs(); } catch { /* ignore */ } });

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: string, color: string, message: string, ...args: unknown[]): string {
  const extra = args.length ? ' ' + args.map(a => {
    if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
  }).join(' ') : '';
  return `${colors.gray}[${timestamp()}]${colors.reset} ${color}[${level}]${colors.reset} ${message}${extra}`;
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    const line = format('INFO', colors.cyan, message, ...args);
    console.log(line);
    writeToFile(line);
  },
  success(message: string, ...args: unknown[]) {
    const line = format('OK', colors.green, message, ...args);
    console.log(line);
    writeToFile(line);
  },
  warn(message: string, ...args: unknown[]) {
    const line = format('WARN', colors.yellow, message, ...args);
    console.warn(line);
    writeToFile(line);
  },
  error(message: string, ...args: unknown[]) {
    const line = format('ERROR', colors.red, message, ...args);
    console.error(line);
    writeToFile(line);
  },
  debug(message: string, ...args: unknown[]) {
    if (process.env.DEBUG === 'true') {
      const line = format('DEBUG', colors.magenta, message, ...args);
      console.log(line);
      writeToFile(line);
    }
  },
  game(message: string, ...args: unknown[]) {
    const line = format('GAME', colors.yellow, message, ...args);
    console.log(line);
    writeToFile(line);
  },
};
