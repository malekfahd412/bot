import { getDB, PlayerDB, CrewDB, TerritoryDB } from '../database/db.js';
import { AdminLogSystem } from './logs.js';
import { logger } from '../utils/logger.js';

export interface ResetPlayerOptions {
  keepDisplayName?: boolean;
  keepAvatar?: boolean;
  startingCoins?: number;
}

export interface ResetCrewOptions {
  wipeMembers?: boolean;
}

export const ResetSystem = {

  resetPlayer(targetId: string, adminId: string, opts: ResetPlayerOptions = {}): void {
    const player = PlayerDB.findByDiscordId(targetId);
    if (!player) throw new Error('Player not found');

    const before = {
      xp: player.xp,
      level: player.level,
      coins: player.coins,
      total_heists: player.total_heists,
      rank: player.rank,
    };

    const startCoins = opts.startingCoins ?? 1000;

    getDB().prepare(`
      UPDATE players SET
        xp = 0,
        level = 1,
        coins = ?,
        rank = 'CIVILIAN',
        total_heists = 0,
        successful_heists = 0,
        failed_heists = 0,
        total_earnings = 0,
        hardest_heist = NULL,
        streak_current = 0,
        streak_longest = 0,
        last_daily = NULL,
        last_heist = NULL,
        updated_at = datetime('now')
      WHERE discord_id = ?
    `).run(startCoins, targetId);

    AdminLogSystem.log({
      adminId,
      actionType: 'player_reset',
      target: targetId,
      beforeSnapshot: before,
      details: { startingCoins: startCoins },
    });

    logger.game(`Player reset: ${targetId} by admin ${adminId}`);
  },

  resetAllPlayers(adminId: string): number {
    const db = getDB();

    const before = db.prepare('SELECT COUNT(*) as n, SUM(xp) as total_xp FROM players').get() as { n: number; total_xp: number };

    const doReset = db.transaction(() => {
      return db.prepare(`
        UPDATE players SET
          xp = 0,
          level = 1,
          coins = 1000,
          rank = 'CIVILIAN',
          total_heists = 0,
          successful_heists = 0,
          failed_heists = 0,
          total_earnings = 0,
          hardest_heist = NULL,
          streak_current = 0,
          streak_longest = 0,
          last_daily = NULL,
          last_heist = NULL,
          updated_at = datetime('now')
      `).run();
    });

    const result = doReset();

    AdminLogSystem.log({
      adminId,
      actionType: 'global_reset',
      target: 'all_players',
      beforeSnapshot: before,
      details: { affected: result.changes },
    });

    logger.game(`Global player reset by admin ${adminId} — ${result.changes} players affected`);
    return result.changes;
  },

  resetCrew(crewId: string, adminId: string, opts: ResetCrewOptions = {}): void {
    const db = getDB();
    const crew = CrewDB.findById(crewId);
    if (!crew) throw new Error('Crew not found');

    const before = {
      bank_balance: crew.bank_balance,
      reputation: crew.reputation,
      level: crew.level,
      total_earnings: crew.total_earnings,
      territories_owned: crew.territories_owned,
    };

    const doReset = db.transaction(() => {
      db.prepare(`
        UPDATE crews SET
          bank_balance = 0,
          reputation = 0,
          level = 1,
          territories_owned = '[]',
          total_heists = 0,
          total_earnings = 0
        WHERE id = ?
      `).run(crewId);

      db.prepare("UPDATE territories SET control_crew_id = NULL, last_contested = NULL WHERE control_crew_id = ?").run(crewId);

      if (opts.wipeMembers) {
        db.prepare("UPDATE players SET crew_id = NULL WHERE crew_id = ? AND discord_id != ?").run(crewId, crew.owner_id);
        db.prepare("UPDATE crews SET member_count = 1 WHERE id = ?").run(crewId);
      }
    });

    doReset();

    AdminLogSystem.log({
      adminId,
      actionType: 'crew_reset',
      target: crewId,
      beforeSnapshot: before,
      details: { crewName: crew.name, wipeMembers: opts.wipeMembers ?? false },
    });

    logger.game(`Crew reset: ${crew.name} (${crewId}) by admin ${adminId}`);
  },
};
