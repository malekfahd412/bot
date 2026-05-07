import { PlayerDB, AchievementDB } from '../database/db.js';
import { getRank, getLevelFromXP } from '../utils/helpers.js';
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
      logger.game(`Player ${discordId} leveled up to ${newLevel}`);
    }

    if (rankChanged) {
      logger.game(`Player ${discordId} ranked up to ${newRank.name}`);
      PlayerDB.update(discordId, { rank: newRank.name });
      this.checkRankAchievement(discordId, newRank.name);
    }

    return { leveledUp, newLevel, newRank: rankChanged ? newRank.name : undefined, rankChanged };
  }

  static awardCoins(discordId: string, amount: number): void {
    PlayerDB.addCoins(discordId, amount);
    PlayerDB.update(discordId, {
      total_earnings: (PlayerDB.findByDiscordId(discordId)?.total_earnings ?? 0) + amount,
    });
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
    } else {
      updates.failed_heists = player.failed_heists + 1;
    }

    PlayerDB.update(discordId, updates);
    this.checkHeistAchievements(discordId, player.successful_heists + (success ? 1 : 0));
  }

  private static checkRankAchievement(discordId: string, rank: string): void {
    const rankAchievements: Record<string, [string, string, string, string]> = {
      ASSOCIATE: ['rank_associate', 'Made Man', 'Reached the rank of Associate', '🔫'],
      SOLDIER: ['rank_soldier', 'Street Soldier', 'Reached the rank of Soldier', '⚔️'],
      LIEUTENANT: ['rank_lieutenant', 'Rising Through the Ranks', 'Reached Lieutenant', '🎯'],
      BOSS: ['rank_boss', 'The Boss', 'Reached the rank of Boss', '👑'],
      KINGPIN: ['rank_kingpin', 'Kingpin', 'Reached the pinnacle — Kingpin', '💎'],
    };

    if (rankAchievements[rank]) {
      const [key, name, desc, icon] = rankAchievements[rank];
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

    if (milestones[successfulHeists]) {
      const [key, name, desc, icon] = milestones[successfulHeists];
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
