import Database from 'better-sqlite3';
import type { Player, HeistSubmission, Crew, Achievement } from './schema.js';
export declare function getDB(): Database.Database;
export declare const PlayerDB: {
    findByDiscordId(discordId: string): Player | undefined;
    create(discordId: string, username: string, avatarUrl?: string): Player;
    findOrCreate(discordId: string, username: string, avatarUrl?: string): Player;
    update(discordId: string, data: Partial<Omit<Player, "id" | "discord_id" | "created_at">>): void;
    clearCrewId(discordId: string): void;
    addXP(discordId: string, xp: number): {
        newXP: number;
        newLevel: number;
        leveledUp: boolean;
    };
    addEarnings(discordId: string, coins: number): void;
    addCoins(discordId: string, coins: number): void;
    addXPRaw(discordId: string, xp: number): void;
    getLeaderboard(limit?: number): Player[];
    getLeaderboardByCoins(limit?: number): Player[];
    getRank(discordId: string): number;
};
export declare const HeistDB: {
    create(data: {
        submitter_id: string;
        heist_name: string;
        difficulty: string;
        teammates: string;
        proof_url: string;
        notes: string | null;
        submission_channel_id: string | null;
    }): HeistSubmission;
    findById(id: string): HeistSubmission | undefined;
    findPending(): HeistSubmission[];
    approve(id: string, reviewerId: string, reviewNote?: string): void;
    reject(id: string, reviewerId: string, reviewNote?: string): void;
    setAwardedAmounts(id: string, xp: number, coins: number): void;
    setReviewMessageId(id: string, messageId: string): void;
    getPlayerHistory(discordId: string, limit?: number): HeistSubmission[];
    countPending(): number;
};
export declare const CrewDB: {
    create(name: string, tag: string, ownerId: string, description?: string): Crew;
    findById(id: string): Crew | undefined;
    findByName(name: string): Crew | undefined;
    findByTag(tag: string): Crew | undefined;
    getMembers(crewId: string): Player[];
    addMember(crewId: string, discordId: string): void;
    removeMember(crewId: string, discordId: string): void;
    update(id: string, data: Partial<Crew>): void;
    recordHeistEarnings(crewId: string, earnings: number): void;
    getLeaderboard(limit?: number): Crew[];
};
export declare const AchievementDB: {
    unlock(playerId: string, key: string, name: string, description: string, icon: string): boolean;
    getPlayerAchievements(playerId: string): Achievement[];
};
//# sourceMappingURL=db.d.ts.map