import { RANK_THRESHOLDS } from './constants.js';
export declare function getLevelFromXP(xp: number): number;
export declare function getXPForNextLevel(currentXP: number): number;
export declare function getXPProgress(currentXP: number): {
    current: number;
    needed: number;
    percent: number;
};
export declare function getRank(level: number): typeof RANK_THRESHOLDS[number];
export declare function formatNumber(n: number): string;
export declare function formatCoins(n: number): string;
export declare function getSuccessRate(total: number, successful: number): string;
export declare function truncate(str: string, maxLen: number): string;
export declare function chunkArray<T>(arr: T[], size: number): T[][];
export declare function parseUserMentions(text: string): string[];
export declare function sleep(ms: number): Promise<void>;
export declare function isToday(dateString: string): boolean;
export declare function isYesterday(dateString: string): boolean;
//# sourceMappingURL=helpers.d.ts.map