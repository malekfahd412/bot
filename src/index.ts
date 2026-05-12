import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

config();

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN missing');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const commands = loadCommands();

// 🔥 مهم جدًا: تشغيل events بشكل صحيح
client.once('clientReady', (...args) =>
  readyEvent.execute(...(args as [any]))
);

client.on('interactionCreate', async (interaction) => {
  try {
    await interactionEvent.execute(interaction, commands, {
      reviewChannelId: process.env.REVIEW_CHANNEL_ID,
    });
  } catch (err) {
    logger.error(err);
  }
});

// logs
process.on('unhandledRejection', (e) => logger.error(e));
process.on('uncaughtException', (e) => logger.error(e));

logger.info('Starting bot...');
client.login(TOKEN);
