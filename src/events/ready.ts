import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getDB } from '../database/db.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client): Promise<void> {
  logger.success(`Bot online as ${client.user?.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

  // Initialize database on startup
  getDB();

  client.user?.setPresence({
    activities: [{ name: '🎯 /heist-log | GTA RPG', type: 0 }],
    status: 'online',
  });

  logger.game('GTA Heist RPG is live. Let the operations begin.');
}
