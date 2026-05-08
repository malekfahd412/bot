import { PlayerDB } from '../database/db.js';
import { DAILY_REWARD, STREAK_MILESTONES } from '../utils/constants.js';
import { isToday, isYesterday } from '../utils/helpers.js';
import type { Player } from '../database/schema.js';

export interface DailyResult {
  xp: number;
  coins: number;
  newStreak: number;
  streakBroken: boolean;
  milestoneReached: boolean;
  milestone?: number;
}

export class StreakSystem {
  static claimDaily(discordId: string): DailyResult {
    const player = PlayerDB.findByDiscordId(discordId);
    if (!player) throw new Error('Player not found');

    if (player.last_daily && isToday(player.last_daily)) {
      throw new Error('ALREADY_CLAIMED');
    }

    const streakBroken = player.last_daily ? !isYesterday(player.last_daily) : false;
    const newStreak = streakBroken ? 1 : player.streak_current + 1;
    const newLongest = Math.max(newStreak, player.streak_longest);

    const streakMultiplier = Math.min(1 + (newStreak - 1) * 0.1, 3.0);
    const xp = Math.floor(DAILY_REWARD.xp * streakMultiplier);
    const coins = Math.floor(DAILY_REWARD.coins * streakMultiplier);

    PlayerDB.update(discordId, {
      streak_current: newStreak,
      streak_longest: newLongest,
      last_daily: new Date().toISOString(),
    });

    PlayerDB.addXP(discordId, xp);
    PlayerDB.addCoins(discordId, coins);

    const milestoneReached = STREAK_MILESTONES.includes(newStreak as typeof STREAK_MILESTONES[number]);

    return {
      xp,
      coins,
      newStreak,
      streakBroken,
      milestoneReached,
      milestone: milestoneReached ? newStreak : undefined,
    };
  }

  static getStreakMultiplier(streak: number): number {
    return Math.min(1 + (streak - 1) * 0.1, 3.0);
  }

  static getNextMilestone(streak: number): number | null {
    return STREAK_MILESTONES.find((m) => m > streak) ?? null;
  }
}
