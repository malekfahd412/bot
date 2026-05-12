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
    logger.success('Database initialized');
  }
  return db;
}

/* ───────────────────────── SCHEMA ───────────────────────── */

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 1000,
      crew_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      xp_awarded INTEGER,
      coins_awarded INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT,
      tag TEXT,
      owner_id TEXT,
      description TEXT,
      member_count INTEGER DEFAULT 1,
      total_earnings INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
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
    return getDB().prepare(
      'SELECT * FROM players WHERE discord_id = ?'
    ).get(id) as Player | undefined;
  },

  create(discord_id: string, username: string, avatar_url?: string): Player {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO players (id, discord_id, username, avatar_url)
      VALUES (?, ?, ?, ?)
    `).run(id, discord_id, username, avatar_url ?? null);

    return this.findByDiscordId(discord_id)!;
  },

  findOrCreate(id: string, username: string, avatar?: string): Player {
    return this.findByDiscordId(id) ?? this.create(id, username, avatar);
  },

  update(discord_id: string, data: Partial<Player>): void {
    const keys = Object.keys(data);
    if (!keys.length) return;

    const set = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    getDB()
      .prepare(`UPDATE players SET ${set}, updated_at = ? WHERE discord_id = ?`)
      .run(...values, new Date().toISOString(), discord_id);
  },

  addXP(id: string, xp: number) {
    const p = this.findByDiscordId(id)!;

    const newXP = p.xp + xp;
    const newLevel = Math.floor(newXP / 500) + 1;

    this.update(id, { xp: newXP, level: newLevel });

    return { newXP, newLevel };
  },

  addCoins(id: string, coins: number) {
    getDB().prepare(
      'UPDATE players SET coins = coins + ?, updated_at = ? WHERE discord_id = ?'
    ).run(coins, new Date().toISOString(), id);
  },

  /* 🔥 FIX MISSING METHODS */
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

  getRank(discord_id: string): number {
    const result = getDB().prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM players
      WHERE xp > (
        SELECT xp FROM players WHERE discord_id = ?
      )
    `).get(discord_id) as { rank: number };

    return result.rank;
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
  }
};

/* ───────────────────────── CREW DB ───────────────────────── */

export const CrewDB = {
  create(name: string, tag: string, owner_id: string): Crew {
    const id = uuidv4();

    getDB().prepare(`
      INSERT INTO crews (id, name, tag, owner_id)
      VALUES (?, ?, ?, ?)
    `).run(id, name, tag, owner_id);

    return this.findById(id)!;
  },

  findById(id: string) {
    return getDB()
      .prepare('SELECT * FROM crews WHERE id = ?')
      .get(id) as Crew | undefined;
  },

  findByName(name: string) {
    return getDB()
      .prepare('SELECT * FROM crews WHERE name = ?')
      .get(name) as Crew | undefined;
  }
};

/* ───────────────────────── ACHIEVEMENTS ───────────────────────── */

export const AchievementDB = {
  unlock(player_id: string, key: string, name: string, description: string, icon: string) {
    try {
      getDB().prepare(`
        INSERT INTO achievements
        (id, player_id, achievement_key, achievement_name, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), player_id, key, name, description, icon);

      return true;
    } catch {
      return false;
    }
  }
};
