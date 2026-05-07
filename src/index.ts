import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

config();

const TOKEN = process.env.DISCORD_TOKEN;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN is not set in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const commands = loadCommands();

// Register events
client.once(readyEvent.name, (...args) => readyEvent.execute(...args as [Client]));

client.on(interactionEvent.name, (interaction) =>
  interactionEvent.execute(interaction, commands, {
    reviewChannelId: REVIEW_CHANNEL_ID,
    adminRoleId: ADMIN_ROLE_ID,
  })
);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

logger.info('Starting GTA Heist RPG Bot...');
client.login(TOKEN).catch(err => {
  logger.error('Failed to login:', err);
  process.exit(1);
});
