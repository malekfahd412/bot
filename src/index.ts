import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './utils/logger.js';
import { validateEnvironment } from './utils/env-validator.js';
import { installProcessGuard, registerShutdownCallback } from './utils/process-guard.js';
import { startHealthLogger } from './utils/health.js';
import { loadCommands } from './services/command-loader.js';
import * as readyEvent from './events/ready.js';
import * as interactionEvent from './events/interaction-create.js';

/* ─────────────────────────────────────────────────────────────────────────
   BOOT SEQUENCE
   Order matters: guard → env → client → deploy → login
───────────────────────────────────────────────────────────────────────── */

// 1. Install global error handlers before anything else
installProcessGuard();

// 2. Validate required environment variables
validateEnvironment();

const TOKEN     = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;

/* ─────────────────────────────────────────────────────────────────────────
   AUTO-DEPLOY SLASH COMMANDS
───────────────────────────────────────────────────────────────────────── */

type AnyData = { toJSON: () => unknown; name: string };

async function deployCommands(): Promise<void> {
  const cmdsDir = join(__dirname, 'commands');
  let files: string[];
  try {
    files = readdirSync(cmdsDir).filter(f => f.endsWith('.js'));
  } catch (err) {
    logger.warn('[Deploy] Commands directory not readable:', err);
    return;
  }

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
    } catch (err) {
      logger.warn(`[Deploy] Skipping ${file}:`, err);
    }
  }

  if (commandData.length === 0) {
    logger.warn('[Deploy] No commands found — skipping registration.');
    return;
  }

  logger.info(`[Deploy] Registering ${commandData.length} command(s): ${names.join(', ')}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandData });
    logger.success(`[Deploy] Commands registered to guild ${GUILD_ID} (instant)`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandData });
    logger.success('[Deploy] Commands registered globally (propagates in ≤1h)');
    logger.info('[Deploy] Tip: set DISCORD_GUILD_ID for instant updates during development');
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

// Reconnect on disconnect (Discord WebSocket can drop)
client.on('shardDisconnect', (event, shardId) => {
  logger.warn(`[Discord] Shard ${shardId} disconnected (code: ${event.code})`);
});

client.on('shardReconnecting', (shardId) => {
  logger.info(`[Discord] Shard ${shardId} reconnecting...`);
});

client.on('shardResume', (shardId) => {
  logger.success(`[Discord] Shard ${shardId} resumed`);
});

client.on('error', (err) => {
  logger.error('[Discord] Client error:', err);
  // Do not exit — discord.js handles reconnection automatically
});

/* ─────────────────────────────────────────────────────────────────────────
   GRACEFUL SHUTDOWN
───────────────────────────────────────────────────────────────────────── */

registerShutdownCallback(async () => {
  logger.info('[Shutdown] Destroying Discord client...');
  try {
    client.destroy();
    logger.success('[Shutdown] Discord client destroyed cleanly.');
  } catch (err) {
    logger.error('[Shutdown] Error destroying client:', err);
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   STARTUP
───────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(' GTA HEIST RPG BOT — Starting up');
  logger.info(`  Node.js ${process.version}  |  PID ${process.pid}  |  ${process.env.NODE_ENV ?? 'development'}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Start periodic health logging
  startHealthLogger();

  // Deploy slash commands (non-fatal if it fails)
  try {
    await deployCommands();
  } catch (err) {
    logger.error('[Deploy] Command deployment failed (bot will still start):', err);
  }

  // Login to Discord
  try {
    await client.login(TOKEN);
  } catch (err) {
    logger.error('[Discord] Login failed — check DISCORD_TOKEN:', err);
    process.exit(1);
  }
}

main();
