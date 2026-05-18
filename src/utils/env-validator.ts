import { logger } from './logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   ENVIRONMENT VALIDATOR
   Validates required and optional env vars at startup.
   Exits with a clear message if required vars are missing.
───────────────────────────────────────────────────────────────────────── */

interface EnvSpec {
  name: string;
  required: boolean;
  description: string;
}

const ENV_SPECS: EnvSpec[] = [
  { name: 'DISCORD_TOKEN',     required: true,  description: 'Discord bot token' },
  { name: 'DISCORD_CLIENT_ID', required: true,  description: 'Discord application/client ID' },
  { name: 'DISCORD_GUILD_ID',  required: false, description: 'Guild ID for instant command deployment (dev)' },
  { name: 'REVIEW_CHANNEL_ID', required: false, description: 'Channel for heist submission reviews' },
  { name: 'GAME_CHANNEL_ID',   required: false, description: 'Channel for live event engine output' },
  { name: 'ADMIN_ROLE_ID',     required: false, description: 'Role ID for admin-level commands' },
  { name: 'DEBUG',             required: false, description: 'Set to "true" for verbose debug logging' },
  { name: 'NODE_ENV',          required: false, description: 'Runtime environment (production | development)' },
];

export function validateEnvironment(): void {
  const missing: string[] = [];
  const warned: string[]  = [];

  for (const spec of ENV_SPECS) {
    const val = process.env[spec.name];
    if (!val || val.trim() === '') {
      if (spec.required) {
        missing.push(`  ✗  ${spec.name.padEnd(24)} — ${spec.description} [REQUIRED]`);
      } else {
        warned.push(`  ⚠  ${spec.name.padEnd(24)} — ${spec.description} [optional, not set]`);
      }
    } else {
      logger.debug(`[Env] ${spec.name} = OK`);
    }
  }

  if (missing.length > 0) {
    logger.error('[EnvValidator] Missing required environment variables:');
    for (const m of missing) logger.error(m);
    logger.error('[EnvValidator] Set the above variables and restart the bot.');
    process.exit(1);
  }

  if (warned.length > 0) {
    logger.warn('[EnvValidator] Optional environment variables not set (some features may be disabled):');
    for (const w of warned) logger.warn(w);
  }

  const env = process.env.NODE_ENV ?? 'development';
  logger.info(`[EnvValidator] Environment validated — running in ${env.toUpperCase()} mode`);
}
