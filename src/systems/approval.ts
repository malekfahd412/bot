import { HeistDB, PlayerDB } from '../database/db.js';
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
  skippedTeammates: string[];
}

export class ApprovalSystem {
  static async approve(submissionId: string, reviewerId: string, reviewNote?: string): Promise<ApprovalResult> {
    const submission = HeistSystem.getSubmission(submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending') throw new Error(`This submission is already **${submission.status}**`);

    const difficulty = submission.difficulty as Difficulty;
    const { xp, coins } = HeistSystem.calculateRewards(difficulty);

    HeistDB.approve(submissionId, reviewerId, reviewNote);
    HeistDB.setAwardedAmounts(submissionId, xp, coins);

    const teammates = HeistSystem.getTeammates(submission);
    const allParticipants = [submission.submitter_id, ...teammates];
    const levelResults: ApprovalResult['levelResults'] = [];
    const skippedTeammates: string[] = [];

    for (const discordId of allParticipants) {
      // Auto-register if this is a teammate who hasn't used the bot yet
      const existing = PlayerDB.findByDiscordId(discordId);
      if (!existing) {
        if (discordId === submission.submitter_id) {
          // Submitter must be registered (they used /heist-log)
          logger.warn(`Submitter ${discordId} not found in DB — skipping rewards`);
          skippedTeammates.push(discordId);
          continue;
        }
        // Auto-create teammate with placeholder — they'll fill in their profile later
        PlayerDB.create(discordId, `Player-${discordId.slice(-5)}`);
        logger.info(`Auto-registered teammate ${discordId} to distribute rewards`);
      }

      try {
        const levelResult = PlayerSystem.awardXP(discordId, xp);
        // awardCoins also increments total_earnings atomically
        PlayerSystem.awardCoins(discordId, coins);
        PlayerSystem.recordHeistResult(discordId, true, difficulty, submission.heist_name);

        levelResults.push({ discordId, ...levelResult });

        // Update crew stats if they're in one
        const player = PlayerDB.findByDiscordId(discordId);
        if (player?.crew_id) {
          CrewSystem.recordHeistResult(player.crew_id, coins);
        }

        logger.game(`Rewarded ${discordId}: +${xp} XP, +${coins} coins`);
      } catch (err) {
        logger.error(`Failed to reward ${discordId}:`, err);
        skippedTeammates.push(discordId);
      }
    }

    return {
      submission: HeistDB.findById(submissionId)!,
      xpAwarded: xp,
      coinsAwarded: coins,
      levelResults,
      skippedTeammates,
    };
  }

  static reject(submissionId: string, reviewerId: string, reviewNote?: string): HeistSubmission {
    const submission = HeistSystem.getSubmission(submissionId);
    if (!submission) throw new Error('Submission not found');
    if (submission.status !== 'pending') throw new Error(`This submission is already **${submission.status}**`);

    HeistDB.reject(submissionId, reviewerId, reviewNote);

    // Record the failed heist on all known participants
    const teammates = HeistSystem.getTeammates(submission);
    const allParticipants = [submission.submitter_id, ...teammates];

    for (const discordId of allParticipants) {
      const player = PlayerDB.findByDiscordId(discordId);
      if (!player) continue; // Don't auto-create for rejections
      try {
        PlayerSystem.recordHeistResult(discordId, false, submission.difficulty as Difficulty, submission.heist_name);
      } catch (err) {
        logger.error(`Failed to record rejection for ${discordId}:`, err);
      }
    }

    return HeistDB.findById(submissionId)!;
  }
}
