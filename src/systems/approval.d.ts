import type { HeistSubmission } from '../database/schema.js';
export interface ApprovalResult {
    submission: HeistSubmission;
    xpAwarded: number;
    coinsAwarded: number;
    levelResults: Array<{
        discordId: string;
        leveledUp: boolean;
        newLevel: number;
        rankChanged: boolean;
        newRank?: string;
    }>;
    skippedTeammates: string[];
}
export declare class ApprovalSystem {
    static approve(submissionId: string, reviewerId: string, reviewNote?: string): Promise<ApprovalResult>;
    static reject(submissionId: string, reviewerId: string, reviewNote?: string): HeistSubmission;
}
//# sourceMappingURL=approval.d.ts.map