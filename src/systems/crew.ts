import { CrewDB, PlayerDB } from '../database/db.js';
import { MAX_CREW_SIZE } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import type { Crew, Player } from '../database/schema.js';

export interface CrewWithMembers extends Crew {
  members: Player[];
}

export class CrewSystem {
  static create(name: string, tag: string, ownerId: string, description?: string): Crew {
    if (name.length < 2 || name.length > 32) throw new Error('Crew name must be 2–32 characters');
    if (tag.length < 2 || tag.length > 5) throw new Error('Crew tag must be 2–5 characters');

    const existingName = CrewDB.findByName(name);
    if (existingName) throw new Error('A crew with that name already exists');

    const existingTag = CrewDB.findByTag(tag);
    if (existingTag) throw new Error('A crew with that tag already exists');

    const owner = PlayerDB.findByDiscordId(ownerId);
    if (owner?.crew_id) throw new Error('You are already in a crew');

    const crew = CrewDB.create(name, tag.toUpperCase(), ownerId, description);
    logger.game(`Crew created: ${crew.name} [${crew.tag}] by ${ownerId}`);
    return crew;
  }

  static join(crewId: string, discordId: string): void {
    const crew = CrewDB.findById(crewId);
    if (!crew) throw new Error('Crew not found');

    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) throw new Error('Player not found. Use any command first to register.');
    if (player.crew_id) throw new Error('You are already in a crew. Leave it first.');

    if (crew.member_count >= MAX_CREW_SIZE) throw new Error(`Crew is full (max ${MAX_CREW_SIZE} members)`);

    CrewDB.addMember(crewId, discordId);
    logger.game(`${discordId} joined crew ${crew.name}`);
  }

  static leave(discordId: string): void {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player?.crew_id) throw new Error('You are not in a crew');

    const crew = CrewDB.findById(player.crew_id);
    if (crew?.owner_id === discordId) throw new Error('You are the crew owner. Transfer ownership or disband first.');

    CrewDB.removeMember(player.crew_id, discordId);
    logger.game(`${discordId} left crew ${player.crew_id}`);
  }

  static getWithMembers(crewId: string): CrewWithMembers | undefined {
    const crew = CrewDB.findById(crewId);
    if (!crew) return undefined;
    const members = CrewDB.getMembers(crewId);
    return { ...crew, members };
  }

  static getPlayerCrew(discordId: string): CrewWithMembers | undefined {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player?.crew_id) return undefined;
    return this.getWithMembers(player.crew_id);
  }

  // Atomic single-query update — no race condition
  static recordHeistResult(crewId: string, earnings: number): void {
    CrewDB.recordHeistEarnings(crewId, earnings);
  }

  static getLeaderboard(limit = 10): Crew[] {
    return CrewDB.getLeaderboard(limit);
  }
}
