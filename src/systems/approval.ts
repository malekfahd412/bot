import { HeistDB } from '../database/db.js';
import { PlayerSystem } from './player.js';
import { HeistSystem } from './heist.js';
import { CrewSystem } from './crew.js';
import { logger } from '../utils/logger.js';
import type { Difficulty } from '../utils/constants.js';
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
}

export class ApprovalSystem {
  static async approve(submissionId: string, reviewerId: string, reviewNote?: string): Promise<ApprovalResult> {
    const submission = HeistSystem.getSubmission(submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending') throw new Error('Submission is not pending');

    const difficulty = submission.difficulty as Difficulty;
    const { xp, coins } = HeistSystem.calculateRewards(difficulty);

    HeistDB.approve(submissionId, reviewerId, reviewNote);
    HeistDB.setAwardedAmounts(submissionId, xp, coins);

    const teammates = HeistSystem.getTeammates(submission);
    const allParticipants = [submission.submitter_id, ...teammates];
    const levelResults: ApprovalResult['levelResults'] = [];

    for (const discordId of allParticipants) {
      try {
        const levelResult = PlayerSystem.awardXP(discordId, xp);
        PlayerSystem.awardCoins(discordId, coins);
        PlayerSystem.recordHeistResult(discordId, true, difficulty, submission.heist_name);

        levelResults.push({ discordId, ...levelResult });

        const player = PlayerSystem.get(discordId);
        if (player?.crew_id) {
          CrewSystem.recordHeistResult(player.crew_id, coins);
        }

        logger.game(`Rewarded ${discordId}: +${xp} XP, +${coins} coins`);
      } catch (err) {
        logger.error(`Failed to reward ${discordId}:`, err);
      }
    }

    return { submission, xpAwarded: xp, coinsAwarded: coins, levelResults };
  }

  static reject(submissionId: string, reviewerId: string, reviewNote?: string): HeistSubmission {
    const submission = HeistSystem.getSubmission(submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending') throw new Error('Submission is not pending');

    HeistDB.reject(submissionId, reviewerId, reviewNote);

    const teammates = HeistSystem.getTeammates(submission);
    const allParticipants = [submission.submitter_id, ...teammates];

    for (const discordId of allParticipants) {
      try {
        PlayerSystem.recordHeistResult(discordId, false, submission.difficulty as Difficulty, submission.heist_name);
      } catch (err) {
        logger.error(`Failed to record rejection for ${discordId}:`, err);
      }
    }

    return HeistSystem.getSubmission(submissionId)!;
  }
}
