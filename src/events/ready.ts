import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getDB, checkDBHealth } from '../database/db.js';
import { initEventEngine } from '../systems/events.js';
import { Health } from '../utils/health.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client): Promise<void> {
  logger.success(`Bot online as ${client.user?.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

  // Initialize database and validate it is healthy
  try {
    getDB();
    const dbStatus = checkDBHealth();
    if (dbStatus.ok) {
      logger.success('[Ready] Database health check: OK');
    } else {
      logger.error('[Ready] Database health check FAILED:', dbStatus.error);
    }
  } catch (err) {
    logger.error('[Ready] Database initialization error:', err);
  }

  client.user?.setPresence({
    activities: [{ name: '🎯 /heist-log | GTA RPG', type: 0 }],
    status: 'online',
  });

  const gameChannelId = process.env.GAME_CHANNEL_ID;
  if (gameChannelId) {
    try {
      const engine = initEventEngine(client, gameChannelId);
      engine.start();
      logger.game('[Ready] Event engine online — live operations active.');
    } catch (err) {
      logger.error('[Ready] Event engine failed to start:', err);
    }
  } else {
    logger.warn('[Ready] GAME_CHANNEL_ID not set — event engine disabled.');
  }

  // Log initial health snapshot
  Health.logStatus();

  logger.game('GTA Heist RPG is live. Let the operations begin.');
}
