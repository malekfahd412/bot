import { Collection } from 'discord.js';
import * as profile from '../commands/profile.js';
import * as daily from '../commands/daily.js';
import * as leaderboard from '../commands/leaderboard.js';
import * as stats from '../commands/stats.js';
import * as heistLog from '../commands/heist-log.js';
import * as playerinfo from '../commands/playerinfo.js';
import * as crew from '../commands/crew-dashboard.js';
import * as inventory from '../commands/inventory.js';
import * as admin from '../commands/admin.js';
import { logger } from '../utils/logger.js';

type CommandModule = {
  data: { name: string; toJSON?: () => unknown };
  execute: (interaction: import('discord.js').ChatInputCommandInteraction) => Promise<void>;
};

export function loadCommands(): Collection<string, CommandModule> {
  const commands = new Collection<string, CommandModule>();

  const modules: CommandModule[] = [
    profile as unknown as CommandModule,
    daily as unknown as CommandModule,
    leaderboard as unknown as CommandModule,
    stats as unknown as CommandModule,
    heistLog as unknown as CommandModule,
    playerinfo as unknown as CommandModule,
    crew as unknown as CommandModule,
    inventory as unknown as CommandModule,
    admin as unknown as CommandModule,
];

  for (const mod of modules) {
    commands.set(mod.data.name, mod);
    logger.info(`Loaded command: /${mod.data.name}`);
  }

  logger.success(`${commands.size} commands loaded`);
  return commands;
}
