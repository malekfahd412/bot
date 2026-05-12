import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';
import { initLogger } from './systems/logger/logService.js';

config();

// ── ENV ─────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN missing in .env');
  process.exit(1);
}

// ── Logger INIT (IMPORTANT) ─────────
initLogger();

// ── Client ──────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
  ],
});

// ── Commands ────────────────────────
const commands = loadCommands();

// ── Events ───────────────────────────
client.once(readyEvent.name, (...args) =>
  readyEvent.execute(...(args as [any]))
);

client.on(interactionEvent.name, (interaction) =>
  interactionEvent.execute(interaction, commands, {
    reviewChannelId: REVIEW_CHANNEL_ID,
    adminRoleId: ADMIN_ROLE_ID,
  })
);

// ── Error Handling ───────────────────
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

// ── Start ────────────────────────────
logger.info('Starting GTA Heist RPG Bot...');
client.login(TOKEN).catch((err) => {
  logger.error('Login failed:', err);
  process.exit(1);
});
