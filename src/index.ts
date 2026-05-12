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

// ───────── EVENTS ─────────

// FIX: remove spread (TS2556 fix)
client.once(readyEvent.name, () => {
  readyEvent.execute(client as any);
});

client.on(interactionEvent.name, (interaction) =>
  interactionEvent.execute(
    interaction,
    commands,
    {
      reviewChannelId: process.env.REVIEW_CHANNEL_ID,
    }
  )
);

// ───────── START ─────────
logger.info('Starting bot...');

client.login(TOKEN).catch((err) => {
  logger.error('Login failed:', err);
  process.exit(1);
});
