import type { Player } from '../database/schema.js';
export interface LevelUpResult {
    leveledUp: boolean;
    newLevel: number;
    newRank?: string;
    rankChanged: boolean;
}
export declare class PlayerSystem {
    static getOrCreate(discordId: string, username: string, avatarUrl?: string): Player;
    static get(discordId: string): Player | undefined;
    static awardXP(discordId: string, amount: number): LevelUpResult;
    static awardCoins(discordId: string, amount: number): void;
    static giveCoins(discordId: string, amount: number): void;
    static adminGiveXP(discordId: string, amount: number): LevelUpResult;
    static recordHeistResult(discordId: string, success: boolean, difficulty: string, heistName: string): void;
    private static checkRankAchievement;
    private static checkHeistAchievements;
    static getLeaderboard(type?: 'xp' | 'coins', limit?: number): Player[];
    static getPlayerRank(discordId: string): number;
}
//# sourceMappingURL=player.d.ts.map