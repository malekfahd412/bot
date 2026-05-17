import { CrewDB, PlayerDB, TerritoryDB } from '../database/db.js';
import { MAX_CREW_SIZE } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import type { Crew, Player, Territory } from '../database/schema.js';

export interface CrewWithMembers extends Crew {
  members: Player[];
  territories: Territory[];
}

export class CrewSystem {

  static create(name: string, tag: string, ownerId: string, description?: string): Crew {
    if (CrewDB.findByName(name)) throw new Error(`A crew named **${name}** already exists.`);
    if (CrewDB.findByTag(tag)) throw new Error(`The tag **[${tag}]** is already taken.`);
    if (tag.length > 5) throw new Error('Tag must be 5 characters or fewer.');

    const player = PlayerDB.findByDiscordId(ownerId);
    if (!player) throw new Error('You need to use `/profile` first to create your player profile.');
    if (player.crew_id) throw new Error('You are already in a crew. Leave it first.');

    const crew = CrewDB.create(name, tag.toUpperCase(), ownerId, description);
    CrewDB.addMember(crew.id, ownerId);
    logger.game(`Crew created: ${name} [${tag}] by ${ownerId}`);
    return crew;
  }

  static join(crewId: string, discordId: string): void {
    const crew = CrewDB.findById(crewId);
    if (!crew) throw new Error('Crew not found.');

    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) throw new Error('Player profile not found.');
    if (player.crew_id) throw new Error('You are already in a crew. Leave it first.');

    const members = CrewDB.getMembers(crewId);
    if (members.length >= MAX_CREW_SIZE) throw new Error(`**${crew.name}** is full (${MAX_CREW_SIZE} max).`);

    CrewDB.addMember(crewId, discordId);
    logger.game(`${discordId} joined crew ${crew.name}`);
  }

  static leave(discordId: string): void {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player?.crew_id) throw new Error('You are not in a crew.');

    const crew = CrewDB.findById(player.crew_id);
    if (crew?.owner_id === discordId) throw new Error('You are the crew owner. Transfer ownership or disband before leaving.');

    CrewDB.removeMember(player.crew_id, discordId);
    logger.game(`${discordId} left crew ${crew?.name}`);
  }

  static getPlayerCrew(discordId: string): CrewWithMembers | undefined {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player?.crew_id) return undefined;

    const crew = CrewDB.findById(player.crew_id);
    if (!crew) return undefined;

    return {
      ...crew,
      members: CrewDB.getMembers(crew.id),
      territories: TerritoryDB.getControlledBy(crew.id),
    };
  }

  static getCrew(crewId: string): CrewWithMembers | undefined {
    const crew = CrewDB.findById(crewId);
    if (!crew) return undefined;
    return {
      ...crew,
      members: CrewDB.getMembers(crew.id),
      territories: TerritoryDB.getControlledBy(crew.id),
    };
  }

  static depositToBank(crewId: string, amount: number): void {
    CrewDB.depositToBank(crewId, amount);
  }

  static addReputation(crewId: string, amount: number): void {
    CrewDB.addReputation(crewId, amount);
  }

  static recordHeistResult(crewId: string, earnings: number): void {
    CrewDB.recordHeistEarnings(crewId, earnings);
  }

  static captureTerritory(crewId: string, territoryId: string): void {
    const territory = TerritoryDB.findById(territoryId);
    if (!territory) return;

    const previousOwner = territory.control_crew_id;
    TerritoryDB.setControl(territoryId, crewId);

    const crew = CrewDB.findById(crewId);
    if (!crew) return;

    // Update territories_owned on the crew
    const controlled = TerritoryDB.getControlledBy(crewId);
    const territoryNames = controlled.map(t => t.name);
    CrewDB.setTerritoriesOwned(crewId, territoryNames);

    // Remove from previous owner
    if (previousOwner && previousOwner !== crewId) {
      const prevControlled = TerritoryDB.getControlledBy(previousOwner);
      CrewDB.setTerritoriesOwned(previousOwner, prevControlled.map(t => t.name));
    }

    // Rep bonus for capture
    CrewDB.addReputation(crewId, 50);

    logger.game(`Crew ${crew.name} captured territory: ${territory.name}`);
  }

  static getTerritorySummary(): Territory[] {
    return TerritoryDB.getAll();
  }

  static getLeaderboard(limit = 10): Crew[] {
    return CrewDB.getLeaderboard(limit);
  }
}
