import type { User } from 'discord.js';
import type { Player } from '../database/schema.js';

export function getDiscordDisplayName(user: User): string {
  return user.displayName;
}

export function getPlayerDisplayName(player: Player): string {
  return player.displayName;
}
