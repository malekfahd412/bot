import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

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

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: string, color: string, message: string, ...args: unknown[]): string {
  const extra = args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
  return `${colors.gray}[${timestamp()}]${colors.reset} ${color}[${level}]${colors.reset} ${message}${extra}`;
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    console.log(format('INFO', colors.cyan, message, ...args));
  },
  success(message: string, ...args: unknown[]) {
    console.log(format('OK', colors.green, message, ...args));
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(format('WARN', colors.yellow, message, ...args));
  },
  error(message: string, ...args: unknown[]) {
    console.error(format('ERROR', colors.red, message, ...args));
  },
  debug(message: string, ...args: unknown[]) {
    if (process.env.DEBUG === 'true') {
      console.log(format('DEBUG', colors.magenta, message, ...args));
    }
  },
  game(message: string, ...args: unknown[]) {
    console.log(format('GAME', colors.yellow, message, ...args));
  },
};
