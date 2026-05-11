import { type Difficulty } from '../utils/constants.js';
import type { HeistSubmission } from '../database/schema.js';
export interface HeistSubmitData {
    submitterId: string;
    heistName: string;
    difficulty: Difficulty;
    teammates: string[];
    proofUrl: string;
    notes?: string;
    submissionChannelId?: string;
}
export declare class HeistSystem {
    static submit(data: HeistSubmitData): HeistSubmission;
    static getPendingSubmissions(): HeistSubmission[];
    static getSubmission(id: string): HeistSubmission | undefined;
    static getPlayerHistory(discordId: string, limit?: number): HeistSubmission[];
    static calculateRewards(difficulty: Difficulty): {
        xp: number;
        coins: number;
    };
    static getTeammates(submission: HeistSubmission): string[];
    static setReviewMessage(id: string, messageId: string): void;
    static getDifficultyConfig(difficulty: Difficulty): {
        readonly label: "EASY";
        readonly xp: 100;
        readonly coins: 500;
        readonly color: "#00D26A";
        readonly multiplier: 1;
    } | {
        readonly label: "NORMAL";
        readonly xp: 250;
        readonly coins: 1250;
        readonly color: "#FFA502";
        readonly multiplier: 1.5;
    } | {
        readonly label: "HARD";
        readonly xp: 500;
        readonly coins: 2500;
        readonly color: "#FF4757";
        readonly multiplier: 2;
    };
}
//# sourceMappingURL=heist.d.ts.map