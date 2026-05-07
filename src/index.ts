import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

config();

// ── Environment validation ──────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

// PostgreSQL notice — SQLite is used by default
if (process.env.DATABASE_URL) {
  logger.warn('DATABASE_URL detected. The bot currently uses SQLite by default.');
  logger.warn('To switch to PostgreSQL: run pg-schema.sql against your database, then update db.ts to use the pg adapter.');
  logger.warn('Continuing with SQLite for now...');
}

// ── Discord client ──────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ── Commands ────────────────────────────────────────────────────────────────
const commands = loadCommands();

// ── Events ──────────────────────────────────────────────────────────────────
client.once(readyEvent.name, (...args) => readyEvent.execute(...args as [Client]));

client.on(interactionEvent.name, (interaction) =>
  interactionEvent.execute(interaction, commands, {
    reviewChannelId: REVIEW_CHANNEL_ID,
    adminRoleId: ADMIN_ROLE_ID,
  })
);

// ── Process handlers ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

// ── Start ───────────────────────────────────────────────────────────────────
logger.info('Starting GTA Heist RPG Bot...');
client.login(TOKEN).catch(err => {
  logger.error('Login failed:', err);
  process.exit(1);
});
