import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { loadCommands } from './services/command-loader.js';
import { logger } from './utils/logger.js';

config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  logger.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

const commands = loadCommands();
const commandData = [...commands.values()].map(c => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    logger.info(`Registering ${commandData.length} slash commands...`);

    if (GUILD_ID) {
      // Guild-specific (instant, for testing)
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData }
      );
      logger.success(`Registered ${commandData.length} commands to guild ${GUILD_ID}`);
    } else {
      // Global (takes up to 1hr to propagate)
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commandData }
      );
      logger.success(`Registered ${commandData.length} global commands`);
    }
  } catch (err) {
    logger.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
