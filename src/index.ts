import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './utils/logger.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  logger.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set');
  process.exit(1);
}

/* ─────────────────────────────────────────────────────────────────────────
   AUTO-DEPLOY SLASH COMMANDS
   Runs on every startup so Discord always has the current command list.
   Guild registration is instant; global registration propagates in ≤1h.
───────────────────────────────────────────────────────────────────────── */

type AnyData = { toJSON: () => unknown; name: string };

async function deployCommands(): Promise<void> {
  const cmdsDir = join(__dirname, 'commands');
  const files   = readdirSync(cmdsDir).filter(f => f.endsWith('.js'));

  const commandData: unknown[] = [];
  const names: string[]        = [];

  for (const file of files) {
    try {
      const mod = await import(join(cmdsDir, file)) as Record<string, unknown>;
      if (
        mod.data &&
        typeof (mod.data as AnyData).toJSON === 'function' &&
        typeof mod.execute === 'function'
      ) {
        commandData.push((mod.data as AnyData).toJSON());
        names.push(`/${(mod.data as AnyData).name}`);
      }
    } catch { /* individual file errors are non-fatal */ }
  }

  if (commandData.length === 0) {
    logger.warn('No commands found for deployment — skipping.');
    return;
  }

  logger.info(`Deploying ${commandData.length} command(s): ${names.join(', ')}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN!);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID), { body: commandData });
    logger.success(`Commands deployed to guild ${GUILD_ID} (instant)`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID!), { body: commandData });
    logger.success('Commands deployed globally (allow up to 1h to propagate)');
    logger.info('Tip: set DISCORD_GUILD_ID secret for instant command updates during development');
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   DISCORD CLIENT
───────────────────────────────────────────────────────────────────────── */

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

client.once(readyEvent.name, () => {
  readyEvent.execute(client as Parameters<typeof readyEvent.execute>[0]);
});

client.on(interactionEvent.name, (interaction) =>
  interactionEvent.execute(interaction, commands, {
    reviewChannelId: process.env.REVIEW_CHANNEL_ID,
  })
);

/* ─────────────────────────────────────────────────────────────────────────
   STARTUP
───────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  logger.info('Starting bot...');

  try {
    await deployCommands();
  } catch (err) {
    logger.error('Command deployment failed (bot will still start):', err);
  }

  client.login(TOKEN!).catch((err) => {
    logger.error('Login failed:', err);
    process.exit(1);
  });
}

main();
