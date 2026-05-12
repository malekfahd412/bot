import Database from 'better-sqlite3';
import type { Player, HeistSubmission, Crew, Achievement } from './schema.js';

let db: Database.Database;

export function getDB() {
  if (!db) {
    db = new Database('data/game.db');
  }
  return db;
}

// ─────────────────────────────
// PLAYER DB
// ─────────────────────────────
export const PlayerDB = {

  findByDiscordId(discordId: string): Player | undefined {
    return getDB()
      .prepare(`SELECT * FROM players WHERE discord_id = ?`)
      .get(discordId) as Player | undefined;
  },

  create(discordId: string, username: string, avatarUrl?: string): Player {
    const stmt = getDB().prepare(`
      INSERT INTO players (discord_id, username, avatar_url, xp, coins, level)
      VALUES (?, ?, ?, 0, 0, 1)
    `);

    stmt.run(discordId, username, avatarUrl ?? null);

    return this.findByDiscordId(discordId)!;
  },

  findOrCreate(discordId: string, username: string, avatarUrl?: string): Player {
    const existing = this.findByDiscordId(discordId);
    if (existing) return existing;
    return this.create(discordId, username, avatarUrl);
  },

  update(discordId: string, data: Partial<Player>): void {
    const fields = Object.keys(data)
      .map(k => `${k} = ?`)
      .join(', ');

    const values = Object.values(data);

    getDB()
      .prepare(`UPDATE players SET ${fields} WHERE discord_id = ?`)
      .run(...values, discordId);
  },

  addXP(discordId: string, xp: number) {
    const player = this.findByDiscordId(discordId);
    if (!player) return { newXP: 0, newLevel: 1, leveledUp: false };

    const newXP = player.xp + xp;
    const newLevel = Math.floor(newXP / 1000) + 1;

    this.update(discordId, {
      xp: newXP,
      level: newLevel
    });

    return {
      newXP,
      newLevel,
      leveledUp: newLevel > player.level
    };
  },

  addCoins(discordId: string, coins: number) {
    getDB()
      .prepare(`UPDATE players SET coins = coins + ? WHERE discord_id = ?`)
      .run(coins, discordId);
  },

  addEarnings(discordId: string, coins: number) {
    this.addCoins(discordId, coins);
  },

  addXPRaw(discordId: string, xp: number) {
    this.addXP(discordId, xp);
  },

  clearCrewId(discordId: string) {
    getDB()
      .prepare(`UPDATE players SET crew_id = NULL WHERE discord_id = ?`)
      .run(discordId);
  },

  getLeaderboard(limit = 10): Player[] {
    return getDB()
      .prepare(`SELECT * FROM players ORDER BY xp DESC LIMIT ?`)
      .all(limit) as Player[];
  },

  getLeaderboardByCoins(limit = 10): Player[] {
    return getDB()
      .prepare(`SELECT * FROM players ORDER BY coins DESC LIMIT ?`)
      .all(limit) as Player[];
  },

  getRank(discordId: string): number {
    const result = getDB()
      .prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM players
        WHERE xp > (
          SELECT xp FROM players WHERE discord_id = ?
        )
      `)
      .get(discordId) as { rank: number };

    return result?.rank ?? 1;
  },

  // 🔥 NEW FIX
  resetAll(): void {
    getDB().prepare(`DELETE FROM players`).run();
  },

  count(): number {
    const res = getDB()
      .prepare(`SELECT COUNT(*) as count FROM players`)
      .get() as { count: number };

    return res.count;
  }
};

// ─────────────────────────────
// HEIST DB
// ─────────────────────────────
export const HeistDB = {

  create(data: {
    submitter_id: string;
    heist_name: string;
    difficulty: string;
    teammates: string;
    proof_url: string;
    notes: string | null;
    submission_channel_id: string | null;
  }): HeistSubmission {

    const stmt = getDB().prepare(`
      INSERT INTO heist_submissions
      (submitter_id, heist_name, difficulty, teammates, proof_url, notes, submission_channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.submitter_id,
      data.heist_name,
      data.difficulty,
      data.teammates,
      data.proof_url,
      data.notes,
      data.submission_channel_id
    );

    return this.findById(String(info.lastInsertRowid))!;
  },

  findById(id: string): HeistSubmission | undefined {
    return getDB()
      .prepare(`SELECT * FROM heist_submissions WHERE id = ?`)
      .get(id) as HeistSubmission | undefined;
  },

  findPending(): HeistSubmission[] {
    return getDB()
      .prepare(`SELECT * FROM heist_submissions WHERE status = 'pending'`)
      .all() as HeistSubmission[];
  },

  approve(id: string, reviewerId: string): void {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET status = 'approved', reviewer_id = ?
        WHERE id = ?
      `)
      .run(reviewerId, id);
  },

  reject(id: string, reviewerId: string): void {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET status = 'rejected', reviewer_id = ?
        WHERE id = ?
      `)
      .run(reviewerId, id);
  },

  setAwardedAmounts(id: string, xp: number, coins: number): void {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET xp_awarded = ?, coins_awarded = ?
        WHERE id = ?
      `)
      .run(xp, coins, id);
  },

  setReviewMessageId(id: string, messageId: string): void {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET review_message_id = ?
        WHERE id = ?
      `)
      .run(messageId, id);
  },

  getPlayerHistory(discordId: string, limit = 10): HeistSubmission[] {
    return getDB()
      .prepare(`
        SELECT * FROM heist_submissions
        WHERE submitter_id = ?
        ORDER BY id DESC
        LIMIT ?
      `)
      .all(discordId, limit) as HeistSubmission[];
  },

  countPending(): number {
    const res = getDB()
      .prepare(`SELECT COUNT(*) as count FROM heist_submissions WHERE status = 'pending'`)
      .get() as { count: number };

    return res.count;
  },

  // 🔥 NEW FIX
  resetAll(): void {
    getDB().prepare(`DELETE FROM heist_submissions`).run();
  },

  count(): number {
    const res = getDB()
      .prepare(`SELECT COUNT(*) as count FROM heist_submissions`)
      .get() as { count: number };

    return res.count;
  }
};

// ─────────────────────────────
// CREW DB (unchanged logic + safe placeholders)
// ─────────────────────────────
export const CrewDB = {
  create(name: string, tag: string, ownerId: string, description?: string): Crew {
    const stmt = getDB().prepare(`
      INSERT INTO crews (name, tag, owner_id, description)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(name, tag, ownerId, description ?? null);
    return this.findById(String(info.lastInsertRowid))!;
  },

  findById(id: string): Crew | undefined {
    return getDB().prepare(`SELECT * FROM crews WHERE id = ?`).get(id) as Crew | undefined;
  },

  findByName(name: string): Crew | undefined {
    return getDB().prepare(`SELECT * FROM crews WHERE name = ?`).get(name) as Crew | undefined;
  },

  findByTag(tag: string): Crew | undefined {
    return getDB().prepare(`SELECT * FROM crews WHERE tag = ?`).get(tag) as Crew | undefined;
  },

  getMembers(crewId: string): Player[] {
    return getDB()
      .prepare(`SELECT * FROM players WHERE crew_id = ?`)
      .all(crewId) as Player[];
  },

  addMember(crewId: string, discordId: string): void {
    getDB()
      .prepare(`UPDATE players SET crew_id = ? WHERE discord_id = ?`)
      .run(crewId, discordId);
  },

  removeMember(crewId: string, discordId: string): void {
    getDB()
      .prepare(`UPDATE players SET crew_id = NULL WHERE discord_id = ?`)
      .run(discordId);
  },

  update(id: string, data: Partial<Crew>): void {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    getDB()
      .prepare(`UPDATE crews SET ${fields} WHERE id = ?`)
      .run(...values, id);
  },

  recordHeistEarnings(crewId: string, earnings: number): void {
    getDB()
      .prepare(`UPDATE crews SET earnings = earnings + ? WHERE id = ?`)
      .run(earnings, crewId);
  },

  getLeaderboard(limit = 10): Crew[] {
    return getDB()
      .prepare(`SELECT * FROM crews ORDER BY earnings DESC LIMIT ?`)
      .all(limit) as Crew[];
  }
};

// ─────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────
export const AchievementDB = {

  unlock(playerId: string, key: string, name: string, description: string, icon: string): boolean {
    const existing = getDB()
      .prepare(`SELECT * FROM achievements WHERE player_id = ? AND key = ?`)
      .get(playerId, key);

    if (existing) return false;

    getDB()
      .prepare(`
        INSERT INTO achievements (player_id, key, name, description, icon)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(playerId, key, name, description, icon);

    return true;
  },

  getPlayerAchievements(playerId: string): Achievement[] {
    return getDB()
      .prepare(`SELECT * FROM achievements WHERE player_id = ?`)
      .all(playerId) as Achievement[];
  }
};
