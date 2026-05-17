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
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 0,
      rank TEXT NOT NULL DEFAULT 'CIVILIAN',
      total_heists INTEGER NOT NULL DEFAULT 0,
      successful_heists INTEGER NOT NULL DEFAULT 0,
      failed_heists INTEGER NOT NULL DEFAULT 0,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      hardest_heist TEXT,
      streak_current INTEGER NOT NULL DEFAULT 0,
      streak_longest INTEGER NOT NULL DEFAULT 0,
      last_daily TEXT,
      last_heist TEXT,
      crew_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS heist_submissions (
      id TEXT PRIMARY KEY,
      submitter_id TEXT NOT NULL,
      heist_name TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      teammates TEXT NOT NULL DEFAULT '[]',
      proof_url TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT,
      reviewer_note TEXT,
      reviewed_at TEXT,
      xp_awarded INTEGER,
      coins_awarded INTEGER,
      review_message_id TEXT,
      submission_channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      description TEXT,
      icon_url TEXT,
      total_heists INTEGER NOT NULL DEFAULT 0,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      member_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      achievement_key TEXT NOT NULL,
      achievement_name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(player_id, achievement_key)
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

  create(discord_id: string, displayName: string, avatar_url?: string): Player {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO players (id, discord_id, displayName, avatar_url)
      VALUES (?, ?, ?, ?)
    `).run(id, discord_id, displayName, avatar_url ?? null);

    return this.findByDiscordId(discord_id)!;
  },

  findOrCreate(id: string, displayName: string, avatar?: string): Player {
    return this.findByDiscordId(id) ?? this.create(id, displayName, avatar);
  },

  update(discord_id: string, data: Partial<Omit<Player, 'id' | 'discord_id' | 'created_at'>>): void {
    const keys = Object.keys(data);
    if (!keys.length) return;

    const set = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    getDB()
      .prepare(`UPDATE players SET ${set}, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(...values, discord_id);
  },

  addXP(id: string, xp: number) {
    const p = this.findByDiscordId(id)!;

    const newXP = p.xp + xp;
    const newLevel = Math.floor(newXP / 500) + 1;
    const leveledUp = newLevel > p.level;

    getDB()
      .prepare(`UPDATE players SET xp = ?, level = ?, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(newXP, newLevel, id);

    return { newXP, newLevel, leveledUp };
  },

  addCoins(id: string, coins: number) {
    getDB()
      .prepare(`UPDATE players SET coins = coins + ?, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(coins, id);
  },

  addEarnings(id: string, coins: number) {
    getDB()
      .prepare(`
        UPDATE players
        SET coins = coins + ?, total_earnings = total_earnings + ?, updated_at = datetime('now')
        WHERE discord_id = ?
      `)
      .run(coins, coins, id);
  },

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
  create(data: {
    submitter_id: string;
    heist_name: string;
    difficulty: string;
    teammates: string;
    proof_url: string;
    notes: string | null;
    submission_channel_id?: string | null;
  }): HeistSubmission {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO heist_submissions
      (id, submitter_id, heist_name, difficulty, teammates, proof_url, notes, submission_channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.submitter_id,
      data.heist_name,
      data.difficulty,
      data.teammates,
      data.proof_url,
      data.notes,
      data.submission_channel_id ?? null
    );

    return this.findById(id)!;
  },

  findById(id: string) {
    return getDB()
      .prepare('SELECT * FROM heist_submissions WHERE id = ?')
      .get(id) as HeistSubmission | undefined;
  },

  findPending() {
    return getDB()
      .prepare("SELECT * FROM heist_submissions WHERE status = 'pending' ORDER BY created_at ASC")
      .all() as HeistSubmission[];
  },

  approve(id: string, reviewerId: string, note?: string) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET status = 'approved', reviewer_id = ?, reviewer_note = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `)
      .run(reviewerId, note ?? null, id);
  },

  reject(id: string, reviewerId: string, note?: string) {
    getDB()
      .prepare(`
        UPDATE heist_submissions
        SET status = 'rejected', reviewer_id = ?, reviewer_note = ?, reviewed_at = datetime('now')
        WHERE id = ?
      `)
      .run(reviewerId, note ?? null, id);
  },

  setAwardedAmounts(id: string, xp: number, coins: number) {
    getDB()
      .prepare(`UPDATE heist_submissions SET xp_awarded = ?, coins_awarded = ? WHERE id = ?`)
      .run(xp, coins, id);
  },

  setReviewMessageId(id: string, msg: string) {
    getDB()
      .prepare(`UPDATE heist_submissions SET review_message_id = ? WHERE id = ?`)
      .run(msg, id);
  },

  getPlayerHistory(id: string, limit = 10) {
    return getDB()
      .prepare(`
        SELECT * FROM heist_submissions
        WHERE submitter_id = ?
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

  findById(id: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE id = ?').get(id) as Crew | undefined;
  },

  findByName(name: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE name = ?').get(name) as Crew | undefined;
  },

  findByTag(tag: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE tag = ?').get(tag) as Crew | undefined;
  },

  addMember(id: string, user: string) {
    PlayerDB.update(user, { crew_id: id });
    getDB()
      .prepare('UPDATE crews SET member_count = member_count + 1 WHERE id = ?')
      .run(id);
  },

  removeMember(id: string, user: string) {
    PlayerDB.update(user, { crew_id: null });
    getDB()
      .prepare('UPDATE crews SET member_count = MAX(0, member_count - 1) WHERE id = ?')
      .run(id);
  },

  getMembers(id: string): Player[] {
    return getDB()
      .prepare('SELECT * FROM players WHERE crew_id = ?')
      .all(id) as Player[];
  },

  recordHeistEarnings(id: string, money: number) {
    getDB()
      .prepare(`
        UPDATE crews
        SET total_earnings = total_earnings + ?, total_heists = total_heists + 1
        WHERE id = ?
      `)
      .run(money, id);
  },

  getLeaderboard(limit = 10): Crew[] {
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
  unlock(player: string, key: string, name: string, desc: string, icon: string): boolean {
    try {
      getDB().prepare(`
        INSERT OR IGNORE INTO achievements
        (id, player_id, achievement_key, achievement_name, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), player, key, name, desc, icon);

      return true;
    } catch {
      return false;
    }
  },

  getPlayerAchievements(id: string): Achievement[] {
    return getDB()
      .prepare('SELECT * FROM achievements WHERE player_id = ? ORDER BY unlocked_at DESC')
      .all(id) as Achievement[];
  }
};
