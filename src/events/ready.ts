import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getDB } from '../database/db.js';
import { initEventEngine } from '../systems/events.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client): Promise<void> {
  logger.success(`Bot online as ${client.user?.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

  getDB();

  client.user?.setPresence({
    activities: [{ name: '🎯 /heist-log | GTA RPG', type: 0 }],
    status: 'online',
  });

  const gameChannelId = process.env.GAME_CHANNEL_ID;
  if (gameChannelId) {
    const engine = initEventEngine(client, gameChannelId);
    engine.start();
    logger.game('Event engine online — live operations will appear in game channel.');
  } else {
    logger.warn('GAME_CHANNEL_ID not set — event engine disabled. Set it to enable live heist/territory events.');
  }

  logger.game('GTA Heist RPG is live. Let the operations begin.');
}
