import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

config();

// ── Environment validation ──────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

if (!CLIENT_ID || !GUILD_ID) {
  logger.error('CLIENT_ID or GUILD_ID missing in .env');
  process.exit(1);
}

// ── Commands ────────────────────────────────────────────────────────────────
const commands = loadCommands();

// ── Auto Sync Slash Commands ────────────────────────────────────────────────
async function syncCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN!);

    const commandData = commands.map(cmd => cmd.data.toJSON());

    logger.info('🔄 Auto-syncing slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID!),
      { body: commandData }
    );

    logger.info('✅ Slash commands synced successfully');
  } catch (err) {
    logger.error('❌ Failed to sync commands:', err);
  }
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
async function start() {
  try {
    logger.info('Starting GTA Heist RPG Bot...');

    await syncCommands(); // 🔥 AUTO SYNC HERE

    await client.login(TOKEN);
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();
