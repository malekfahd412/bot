/**
 * deploy-commands.ts
 *
 * Auto-discovers every command file in dist/commands/, validates it, and
 * registers it with Discord via the REST API.
 *
 * Guild registration  (instant, dev):  set DISCORD_GUILD_ID in environment
 * Global registration (≤1h, prod):     omit DISCORD_GUILD_ID
 */

import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('[DEPLOY] ❌  DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.');
  process.exit(1);
}

type AnyData = { toJSON: () => unknown; name: string };

(async () => {
  /* ── locate dist/commands/ next to this compiled file ── */
  const CMDS_DIR = join(__dirname, 'commands');
  const files    = readdirSync(CMDS_DIR).filter(f => f.endsWith('.js'));

  console.log(`[DEPLOY] 🔍  Scanning ${files.length} file(s) in ${CMDS_DIR}`);

  const commandData: unknown[] = [];
  const loaded:  string[]      = [];
  const skipped: string[]      = [];

  for (const file of files) {
    const filePath = join(CMDS_DIR, file);
    try {
      /* dynamic import works inside async fn even in CJS output */
      const mod = await import(filePath) as Record<string, unknown>;

      if (!mod.data || typeof (mod.data as AnyData).toJSON !== 'function') {
        skipped.push(`${file} — missing "data" export or toJSON()`);
        continue;
      }
      if (typeof mod.execute !== 'function') {
        skipped.push(`${file} — missing "execute" export`);
        continue;
      }

      const data = mod.data as AnyData;
      commandData.push(data.toJSON());
      loaded.push(`/${data.name}`);
    } catch (err) {
      skipped.push(`${file} — import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (skipped.length) {
    for (const s of skipped) console.warn(`[DEPLOY] ⚠️   Skipped: ${s}`);
  }

  if (commandData.length === 0) {
    console.error('[DEPLOY] ❌  No valid commands found. Aborting.');
    process.exit(1);
  }

  console.log(`[DEPLOY] 📦  Registering ${commandData.length} command(s): ${loaded.join(', ')}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN!);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID), { body: commandData });
    console.log(`[DEPLOY] ✅  Registered ${commandData.length} command(s) to guild ${GUILD_ID} (instant).`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID!), { body: commandData });
    console.log(`[DEPLOY] ✅  Registered ${commandData.length} global command(s).`);
    console.log('[DEPLOY] 💡  Tip: set DISCORD_GUILD_ID for instant registration during development.');
  }
})().catch(err => {
  console.error('[DEPLOY] ❌  Fatal error:', err);
  process.exit(1);
});
