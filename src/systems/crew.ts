import { CrewDB, PlayerDB } from '../database/db.js';
import { MAX_CREW_SIZE } from '../utils/constants.js';
import type { Crew, Player } from '../database/schema.js';

export interface CrewWithMembers extends Crew {
  members: Player[];
}

export class CrewSystem {

  static join(crewId: string, discordId: string): void {
    const crew = CrewDB.findById(crewId);

    if (!crew)
      throw new Error('Crew not found');

    const player = PlayerDB.findByDiscordId(discordId);

    if (!player)
      throw new Error('Player profile not found');

    if (player.crew_id)
      throw new Error('You are already in a crew');

    const members = CrewDB.getMembers(crewId);

    if (members.length >= MAX_CREW_SIZE)
      throw new Error('Crew is full');

    CrewDB.addMember(crewId, discordId);
  }

  static leave(discordId: string): void {
    const player = PlayerDB.findByDiscordId(discordId);

    if (!player?.crew_id)
      throw new Error('You are not in a crew');

    CrewDB.removeMember(player.crew_id, discordId);
  }

  static getPlayerCrew(discordId: string): CrewWithMembers | undefined {
    const player = PlayerDB.findByDiscordId(discordId);

    if (!player?.crew_id)
      return undefined;

    const crew = CrewDB.findById(player.crew_id);

    if (!crew)
      return undefined;

    return {
      ...crew,
      members: CrewDB.getMembers(crew.id),
    };
  }

  static recordHeistResult(crewId: string, earnings: number): void {
    CrewDB.recordHeistEarnings(crewId, earnings);
  }

  static getLeaderboard(limit = 10): Crew[] {
    return CrewDB.getLeaderboard(limit);
  }
}
