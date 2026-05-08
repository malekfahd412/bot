import { HeistDB, PlayerDB } from '../database/db.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
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

export class HeistSystem {
  static submit(data: HeistSubmitData): HeistSubmission {
    const submission = HeistDB.create({
      submitter_id: data.submitterId,
      heist_name: data.heistName,
      difficulty: data.difficulty,
      teammates: JSON.stringify(data.teammates),
      proof_url: data.proofUrl,
      notes: data.notes ?? null,
      submission_channel_id: data.submissionChannelId ?? null,
    });

    logger.game(`Heist submission created: ${submission.id} by ${data.submitterId}`);
    return submission;
  }

  static getPendingSubmissions(): HeistSubmission[] {
    return HeistDB.findPending();
  }

  static getSubmission(id: string): HeistSubmission | undefined {
    return HeistDB.findById(id);
  }

  static getPlayerHistory(discordId: string, limit = 10): HeistSubmission[] {
    return HeistDB.getPlayerHistory(discordId, limit);
  }

  static calculateRewards(difficulty: Difficulty): { xp: number; coins: number } {
    const config = DIFFICULTY_CONFIG[difficulty];
    const xpVariance = Math.floor(Math.random() * 50) - 25;
    const coinVariance = Math.floor(Math.random() * 200) - 100;
    return {
      xp: Math.max(config.xp + xpVariance, 10),
      coins: Math.max(config.coins + coinVariance, 100),
    };
  }

  static getTeammates(submission: HeistSubmission): string[] {
    try {
      return JSON.parse(submission.teammates) as string[];
    } catch {
      return [];
    }
  }

  static setReviewMessage(id: string, messageId: string): void {
    HeistDB.setReviewMessageId(id, messageId);
  }

  static getDifficultyConfig(difficulty: Difficulty) {
    return DIFFICULTY_CONFIG[difficulty];
  }
}
