import type { Crew, Player } from '../database/schema.js';
export interface CrewWithMembers extends Crew {
    members: Player[];
}
export declare class CrewSystem {
    static create(name: string, tag: string, ownerId: string, description?: string): Crew;
    static join(crewId: string, discordId: string): void;
    static leave(discordId: string): void;
    static getWithMembers(crewId: string): CrewWithMembers | undefined;
    static getPlayerCrew(discordId: string): CrewWithMembers | undefined;
    static recordHeistResult(crewId: string, earnings: number): void;
    static getLeaderboard(limit?: number): Crew[];
}
//# sourceMappingURL=crew.d.ts.map