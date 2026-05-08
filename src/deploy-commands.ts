import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';

config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  logger.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────
// Import commands
// ─────────────────────────────────────────────
import { data as profile } from './commands/profile.js';
import { data as daily } from './commands/daily.js';
import { data as leaderboard } from './commands/leaderboard.js';
import { data as stats } from './commands/stats.js';
import { data as heistLog } from './commands/heist-log.js';
import { data as crew } from './commands/crew.js';
import { data as inventory } from './commands/inventory.js';
import { data as admin } from './commands/admin.js';

// ─────────────────────────────────────────────
// FIX: normalize commands safely
// ─────────────────────────────────────────────
const commands = [
  profile,
  daily,
  leaderboard,
  stats,
  heistLog,
  crew,
  inventory,
  admin,
];

// ensure proper SlashCommandBuilder format
const commandData = commands.map((cmd) => {
  if (cmd instanceof SlashCommandBuilder) {
    return cmd.toJSON();
  }

  // fallback safety (prevents runtime crash)
  return (cmd as any).toJSON?.() ?? cmd;
});

// ─────────────────────────────────────────────
// REST setup
// ─────────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(TOKEN);

// ─────────────────────────────────────────────
// Deploy
// ─────────────────────────────────────────────
(async () => {
  try {
    logger.info(`🔄 Registering ${commandData.length} slash commands...`);

    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData }
      );

      logger.success(`✅ Registered ${commandData.length} commands to guild`);
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commandData }
      );

      logger.success(`🌍 Registered ${commandData.length} global commands`);
    }
  } catch (err) {
    logger.error('❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
