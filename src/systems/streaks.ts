import { STREAK_MILESTONES, DAILY_REWARD } from '../utils/constants.js';

export class StreakSystem {
  private static userStreaks = new Map<string, {
    lastClaim: number;
    streak: number;
  }>();

  static claimDaily(userId: string) {
    const now = Date.now();
    const data = this.userStreaks.get(userId);

    let streak = 1;
    let streakBroken = false;

    if (data) {
      const diff = now - data.lastClaim;
      const oneDay = 24 * 60 * 60 * 1000;

      if (diff < oneDay) {
        throw new Error('ALREADY_CLAIMED');
      }

      if (diff <= oneDay * 2) {
        streak = data.streak + 1;
      } else {
        streak = 1;
        streakBroken = true;
      }
    }

    const milestoneReached = STREAK_MILESTONES.includes(streak);

    const multiplier = this.getStreakMultiplier(streak);

    const xp = Math.floor(DAILY_REWARD.xp * multiplier);
    const coins = Math.floor(DAILY_REWARD.coins * multiplier);

    this.userStreaks.set(userId, {
      lastClaim: now,
      streak,
    });

    return {
      newStreak: streak,
      streakBroken,
      milestoneReached,
      milestone: streak,
      xp,
      coins,
    };
  }

  static getNextMilestone(streak: number): number | null {
    return [...STREAK_MILESTONES].find(m => m > streak) ?? null;
  }

  static getStreakMultiplier(streak: number): number {
    if (streak >= 100) return 3;
    if (streak >= 60) return 2.5;
    if (streak >= 30) return 2;
    if (streak >= 14) return 1.5;
    if (streak >= 7) return 1.2;
    return 1;
  }
}
