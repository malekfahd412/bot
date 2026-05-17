import { getDB, PlayerDB, SeasonDB } from '../database/db.js';
import { AdminLogSystem } from './logs.js';
import { logger } from '../utils/logger.js';
import type { Season } from '../database/schema.js';

export interface SeasonStartOptions {
  name: string;
  resetXP: boolean;
  resetCoins: boolean;
}

export const SeasonSystem = {

  startSeason(opts: SeasonStartOptions, adminId: string): Season {
    const db = getDB();

    // Auto-end any active season
    const active = this.getActiveSeason();
    if (active) {
      this.endSeason(adminId);
    }

    // Snapshot top 25 before reset
    const preSnapshot = PlayerDB.getLeaderboard(25).map(p => ({
      discord_id: p.discord_id,
      display_name: p.display_name,
      xp: p.xp,
      level: p.level,
      coins: p.coins,
    }));

    // Apply player resets atomically
    const doReset = db.transaction(() => {
      const xpParts = opts.resetXP
        ? ["xp = 0", "level = 1", "rank = 'CIVILIAN'", "total_heists = 0", "successful_heists = 0", "failed_heists = 0", "total_earnings = 0", "hardest_heist = NULL"]
        : [];
      const coinParts = opts.resetCoins ? ["coins = 1000"] : [];
      const always = ["streak_current = 0", "last_daily = NULL", "last_heist = NULL", "updated_at = datetime('now')"];

      const parts = [...xpParts, ...coinParts, ...always];
      db.prepare(`UPDATE players SET ${parts.join(', ')}`).run();

      // Reset territories
      db.prepare('UPDATE territories SET control_crew_id = NULL, last_contested = NULL').run();

      // Soft-reset crews
      db.prepare("UPDATE crews SET bank_balance = 0, reputation = 0, level = 1, territories_owned = '[]'").run();
    });

    doReset();

    const season = SeasonDB.create(opts.name);

    AdminLogSystem.log({
      adminId,
      actionType: 'season_start',
      details: {
        seasonId: season.id,
        seasonName: opts.name,
        resetXP: opts.resetXP,
        resetCoins: opts.resetCoins,
        preSnapshot: JSON.stringify(preSnapshot),
      },
    });

    logger.game(`Season started: "${opts.name}" (id=${season.id}) by admin ${adminId}`);
    return season;
  },

  endSeason(adminId: string): Season {
    const active = this.getActiveSeason();
    if (!active) throw new Error('No active season to end.');

    const results = PlayerDB.getLeaderboard(25).map((p, i) => ({
      rank: i + 1,
      discord_id: p.discord_id,
      display_name: p.display_name,
      xp: p.xp,
      level: p.level,
      coins: p.coins,
      total_heists: p.total_heists,
    }));

    SeasonDB.end(active.id, JSON.stringify(results));

    AdminLogSystem.log({
      adminId,
      actionType: 'season_end',
      details: { seasonId: active.id, seasonName: active.name },
    });

    logger.game(`Season ended: "${active.name}" (id=${active.id}) by admin ${adminId}`);
    return SeasonDB.findById(active.id)!;
  },

  getActiveSeason(): Season | undefined {
    return SeasonDB.getActive();
  },

  getHistory(limit = 10): Season[] {
    return SeasonDB.getRecent(limit);
  },

  getTopFromSeason(season: Season): Array<{ rank: number; display_name: string; xp: number; level: number }> {
    if (!season.results) return [];
    try {
      return JSON.parse(season.results) as Array<{ rank: number; display_name: string; xp: number; level: number }>;
    } catch {
      return [];
    }
  },
};
