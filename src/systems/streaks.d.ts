export interface DailyResult {
    xp: number;
    coins: number;
    newStreak: number;
    streakBroken: boolean;
    milestoneReached: boolean;
    milestone?: number;
}
export declare class StreakSystem {
    static claimDaily(discordId: string): DailyResult;
    static getStreakMultiplier(streak: number): number;
    static getNextMilestone(streak: number): number | null;
}
//# sourceMappingURL=streaks.d.ts.map