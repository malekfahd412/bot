import { PlayerDB, AchievementDB } from '../database/db.js';
import { getRank } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { Player } from '../database/schema.js';

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  newRank?: string;
  rankChanged: boolean;
}

export class PlayerSystem {
  static getOrCreate(discordId: string, username: string, avatarUrl?: string): Player {
    return PlayerDB.findOrCreate(discordId, username, avatarUrl);
  }

  static get(discordId: string): Player | undefined {
    return PlayerDB.findByDiscordId(discordId);
  }

  static awardXP(discordId: string, amount: number): LevelUpResult {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) throw new Error('Player not found');

    const oldRank = getRank(player.level);
    const { newLevel, leveledUp } = PlayerDB.addXP(discordId, amount);
    const newRank = getRank(newLevel);
    const rankChanged = newRank.name !== oldRank.name;

    if (leveledUp) {
      logger.game(`${player.username} (${discordId}) leveled up to ${newLevel}`);
    }

    if (rankChanged) {
      logger.game(`${player.username} (${discordId}) ranked up to ${newRank.name}`);
      PlayerDB.update(discordId, { rank: newRank.name });
      this.checkRankAchievement(discordId, newRank.name);
    }

    return { leveledUp, newLevel, newRank: rankChanged ? newRank.name : undefined, rankChanged };
  }

  // Awards coins and tracks total_earnings atomically in a single SQL call
  static awardCoins(discordId: string, amount: number): void {
    PlayerDB.addEarnings(discordId, amount);
  }

  // Admin-only: give coins without tracking as heist earnings
  static giveCoins(discordId: string, amount: number): void {
    PlayerDB.addCoins(discordId, amount);
  }

  // Admin-only: directly set XP and recalculate level/rank
  static adminGiveXP(discordId: string, amount: number): LevelUpResult {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) throw new Error('Player not found');
    const oldRank = getRank(player.level);
    PlayerDB.addXP(discordId, amount);
    const updated = PlayerDB.findByDiscordId(discordId)!;
    const newRank = getRank(updated.level);
    const rankChanged = newRank.name !== oldRank.name;
    if (rankChanged) PlayerDB.update(discordId, { rank: newRank.name });
    return {
      leveledUp: updated.level > player.level,
      newLevel: updated.level,
      rankChanged,
      newRank: rankChanged ? newRank.name : undefined,
    };
  }

  static recordHeistResult(discordId: string, success: boolean, difficulty: string, heistName: string): void {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) return;

    const updates: Partial<Player> = {
      total_heists: player.total_heists + 1,
      last_heist: new Date().toISOString(),
    };

    if (success) {
      updates.successful_heists = player.successful_heists + 1;
      const difficultyRank = ['easy', 'medium', 'hard', 'extreme', 'legendary'];
      const currentHardest = player.hardest_heist ?? 'easy';
      if (difficultyRank.indexOf(difficulty) > difficultyRank.indexOf(currentHardest)) {
        updates.hardest_heist = difficulty;
      }
      this.checkHeistAchievements(discordId, player.successful_heists + 1);
    } else {
      updates.failed_heists = player.failed_heists + 1;
    }

    PlayerDB.update(discordId, updates);
  }

  private static checkRankAchievement(discordId: string, rank: string): void {
    const rankAchievements: Record<string, [string, string, string, string]> = {
      ASSOCIATE: ['rank_associate', 'Made Man', 'Reached the rank of Associate', '🔫'],
      SOLDIER: ['rank_soldier', 'Street Soldier', 'Reached the rank of Soldier', '⚔️'],
      LIEUTENANT: ['rank_lieutenant', 'Rising Through the Ranks', 'Reached Lieutenant', '🎯'],
      BOSS: ['rank_boss', 'The Boss', 'Reached the rank of Boss', '👑'],
      KINGPIN: ['rank_kingpin', 'Kingpin', 'Reached the pinnacle — Kingpin', '💎'],
    };

    const entry = rankAchievements[rank];
    if (entry) {
      const [key, name, desc, icon] = entry;
      AchievementDB.unlock(discordId, key, name, desc, icon);
    }
  }

  private static checkHeistAchievements(discordId: string, successfulHeists: number): void {
    const milestones: Record<number, [string, string, string, string]> = {
      1: ['first_heist', 'First Score', 'Completed your first heist', '🎯'],
      10: ['heist_10', 'Seasoned Criminal', 'Completed 10 heists', '💼'],
      25: ['heist_25', 'Career Criminal', 'Completed 25 heists', '🔱'],
      50: ['heist_50', 'Crime Lord', 'Completed 50 heists', '👑'],
      100: ['heist_100', 'Legend of the Streets', 'Completed 100 heists', '💎'],
    };

    const milestone = milestones[successfulHeists];
    if (milestone) {
      const [key, name, desc, icon] = milestone;
      AchievementDB.unlock(discordId, key, name, desc, icon);
    }
  }

  static getLeaderboard(type: 'xp' | 'coins' = 'xp', limit = 10): Player[] {
    return type === 'xp' ? PlayerDB.getLeaderboard(limit) : PlayerDB.getLeaderboardByCoins(limit);
  }

  static getPlayerRank(discordId: string): number {
    return PlayerDB.getRank(discordId);
  }
}
