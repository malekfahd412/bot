import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

import type {
  Player,
  HeistSubmission,
  Crew,
  Achievement
} from './schema.js';

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'game.db');

let db: Database.Database;

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    logger.success('Database ready');
  }
  return db;
}

/* ───────────────────────── SCHEMA ───────────────────────── */

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS heist_submissions (
  id TEXT PRIMARY KEY,
  submitter_id TEXT,
  heist_name TEXT,
  difficulty TEXT,
  teammates TEXT,
  proof_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reviewer_id TEXT,
  reviewer_note TEXT,
  reviewed_at TEXT,
  xp_awarded INTEGER,
  coins_awarded INTEGER,
  review_message_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

    CREATE TABLE IF NOT EXISTS heist_submissions (
  id TEXT PRIMARY KEY,
  submitter_id TEXT,
  heist_name TEXT,
  difficulty TEXT,
  teammates TEXT,
  proof_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reviewer_id TEXT,
  reviewer_note TEXT,
  reviewed_at TEXT,
  xp_awarded INTEGER,
  coins_awarded INTEGER,
  review_message_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT,
      tag TEXT,
      owner_id TEXT,
      description TEXT,
      member_count INTEGER DEFAULT 1,
      total_earnings INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      achievement_key TEXT,
      achievement_name TEXT,
      description TEXT,
      icon TEXT,
      unlocked_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/* ───────────────────────── PLAYER DB ───────────────────────── */

export const PlayerDB = {
  findByDiscordId(id: string): Player | undefined {
    return getDB()
      .prepare('SELECT * FROM players WHERE discord_id = ?')
      .get(id) as Player | undefined;
  },

  create(discord_id: string, display_name: string, avatar_url?: string): Player {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO players (id, discord_id, display_name, avatar_url)
      VALUES (?, ?, ?, ?)
    `).run(id, discord_id, display_name, avatar_url ?? null);

    return this.findByDiscordId(discord_id)!;
  },

  findOrCreate(id: string, display_name: string, avatar?: string): Player {
    return this.findByDiscordId(id) ?? this.create(id, display_name, avatar);
  },

  update(discord_id: string, data: any): void {
    const keys = Object.keys(data);
    if (!keys.length) return;

    const set = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    getDB()
      .prepare(`UPDATE players SET ${set} WHERE discord_id = ?`)
      .run(...values, discord_id);
  },

  addXP(id: string, xp: number) {
    const p = this.findByDiscordId(id)!;

    const newXP = p.xp + xp;
    const newLevel = Math.floor(newXP / 500) + 1;
    const leveledUp = newLevel > p.level;

    this.update(id, { xp: newXP, level: newLevel });

    return { newXP, newLevel, leveledUp };
  },

  addCoins(id: string, coins: number) {
    getDB()
      .prepare('UPDATE players SET coins = coins + ? WHERE discord_id = ?')
      .run(coins, id);
  },

  addEarnings(id: string, coins: number) {
    getDB()
      .prepare(`
        UPDATE players
        SET coins = coins + ?, total_earnings = total_earnings + ?
        WHERE discord_id = ?
      `)
      .run(coins, coins, id);
  },

  /* FIXED METHODS */
  getLeaderboard(limit = 10): Player[] {
    return getDB()
      .prepare('SELECT * FROM players ORDER BY xp DESC LIMIT ?')
      .all(limit) as Player[];
  },

  getLeaderboardByCoins(limit = 10): Player[] {
    return getDB()
      .prepare('SELECT * FROM players ORDER BY coins DESC LIMIT ?')
      .all(limit) as Player[];
  },

  getRank(id: string): number {
    const r = getDB()
      .prepare(`
        SELECT COUNT(*) + 1 as rank FROM players
        WHERE xp > (SELECT xp FROM players WHERE discord_id = ?)
      `)
      .get(id) as { rank: number };

    return r.rank;
  }
};

/* ───────────────────────── HEIST DB ───────────────────────── */

export const HeistDB = {
  create(data: any): HeistSubmission {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO heist_submissions
      (id, submitter_id, heist_name, difficulty, teammates, proof_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.submitter_id,
      data.heist_name,
      data.difficulty,
      data.teammates,
      data.proof_url,
      data.notes
    );

    return this.findById(id)!;
  },

  findById(id: string) {
    return getDB()
      .prepare('SELECT * FROM heist_submissions WHERE id = ?')
      .get(id) as HeistSubmission | undefined;
  },

  /* FIXED MISSING METHODS */
  findPending() {
    return getDB()
      .prepare("SELECT * FROM heist_submissions WHERE status = 'pending'")
      .all() as HeistSubmission[];
  },

  approve(id: string, reviewerId: string, note?: string) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET
          status='approved',
          reviewer_id=?,
          reviewer_note=?,
          reviewed_at=datetime('now', '+3 hours')
        WHERE id=?
      `)
      .run(reviewerId, note ?? null, id);
  },

  reject(id: string, reviewerId: string, note?: string) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET
          status='rejected',
          reviewer_id=?,
          reviewer_note=?,
          reviewed_at=datetime('now', '+3 hours')
        WHERE id=?
      `)
      .run(reviewerId, note ?? null, id);
  },

  setAwardedAmounts(id: string, xp: number, coins: number) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET xp_awarded=?, coins_awarded=?
        WHERE id=?
      `)
      .run(xp, coins, id);
  },

  setReviewMessageId(id: string, msg: string) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET review_message_id=?
        WHERE id=?
      `)
      .run(msg, id);
  },

  getPlayerHistory(id: string, limit = 10) {
    return getDB()
      .prepare(`
        SELECT * FROM heist_submissions
        WHERE submitter_id=?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(id, limit) as HeistSubmission[];
  }
};

/* ───────────────────────── CREW DB ───────────────────────── */

export const CrewDB = {
  create(name: string, tag: string, owner: string, desc?: string): Crew {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO crews (id, name, tag, owner_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, tag, owner, desc ?? null);

    return this.findById(id)!;
  },

  findById(id: string) {
    return getDB().prepare('SELECT * FROM crews WHERE id=?').get(id) as Crew;
  },

  findByName(name: string) {
    return getDB().prepare('SELECT * FROM crews WHERE name=?').get(name) as Crew;
  },

  findByTag(tag: string) {
    return getDB().prepare('SELECT * FROM crews WHERE tag=?').get(tag) as Crew;
  },

  addMember(id: string, user: string) {
    PlayerDB.update(user, { crew_id: id });
  },

  removeMember(id: string, user: string) {
    PlayerDB.update(user, { crew_id: null });
  },

  getMembers(id: string) {
    return getDB()
      .prepare('SELECT * FROM players WHERE crew_id=?')
      .all(id) as Player[];
  },

  recordHeistEarnings(id: string, money: number) {
    getDB()
      .prepare(`
        UPDATE crews
        SET total_earnings = total_earnings + ?
        WHERE id=?
      `)
      .run(money, id);
  },

  getLeaderboard(limit = 10) {
    return getDB()
      .prepare('SELECT * FROM crews ORDER BY total_earnings DESC LIMIT ?')
      .all(limit) as Crew[];
  },

  getAllCrews(): Crew[] {
    return getDB()
      .prepare('SELECT * FROM crews ORDER BY total_earnings DESC')
      .all() as Crew[];
  }
};

/* ───────────────────────── ACHIEVEMENTS ───────────────────────── */

export const AchievementDB = {
  unlock(player: string, key: string, name: string, desc: string, icon: string) {
    try {
      getDB().prepare(`
        INSERT INTO achievements
        (id, player_id, achievement_key, achievement_name, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), player, key, name, desc, icon);

      return true;
    } catch {
      return false;
    }
  },

  getPlayerAchievements(id: string) {
    return getDB()
      .prepare('SELECT * FROM achievements WHERE player_id=?')
      .all(id) as Achievement[];
  }
};
