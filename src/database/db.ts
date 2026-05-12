import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import type { Player, HeistSubmission, Crew, Achievement } from './schema.js';

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'game.db');

let db: Database.Database;

// safer UUID for Replit / Node 20+
function uuid(): string {
  return crypto.randomUUID();
}

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    logger.success('Database initialized at ' + DB_PATH);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      avatar_url TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 1000,
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
      xp_awarded INTEGER,
      coins_awarded INTEGER,
      review_message_id TEXT,
      submission_channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      tag TEXT UNIQUE NOT NULL,
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
      icon TEXT NOT NULL DEFAULT '🏆',
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(player_id, achievement_key)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'misc',
      quantity INTEGER NOT NULL DEFAULT 1,
      acquired_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/* ───────── PLAYER ───────── */

export const PlayerDB = {
  findByDiscordId(discordId: string): Player | undefined {
    return getDB()
      .prepare('SELECT * FROM players WHERE discord_id = ?')
      .get(discordId) as Player | undefined;
  },

  create(discordId: string, username: string, avatarUrl?: string): Player {
    const id = uuid();

    getDB()
      .prepare(
        `INSERT INTO players (id, discord_id, username, avatar_url)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, discordId, username, avatarUrl ?? null);

    return this.findByDiscordId(discordId)!;
  },

  findOrCreate(discordId: string, username: string, avatarUrl?: string): Player {
    return this.findByDiscordId(discordId) ?? this.create(discordId, username, avatarUrl);
  },

  update(
    discordId: string,
    data: Partial<Omit<Player, 'id' | 'discord_id' | 'created_at'>>
  ): void {
    const keys = Object.keys(data);

    if (keys.length === 0) return;

    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);

    getDB()
      .prepare(
        `UPDATE players SET ${sets}, updated_at = ? WHERE discord_id = ?`
      )
      .run(...values, new Date().toISOString(), discordId);
  },

  clearCrewId(discordId: string): void {
    getDB()
      .prepare(
        `UPDATE players SET crew_id = NULL, updated_at = ? WHERE discord_id = ?`
      )
      .run(new Date().toISOString(), discordId);
  },

  addXP(discordId: string, xp: number) {
    const player = this.findByDiscordId(discordId)!;

    const newXP = player.xp + xp;
    const newLevel = Math.floor(newXP / 500) + 1;
    const leveledUp = newLevel > player.level;

    this.update(discordId, { xp: newXP, level: newLevel });

    return { newXP, newLevel, leveledUp };
  },

  addEarnings(discordId: string, coins: number): void {
    getDB()
      .prepare(
        `UPDATE players
         SET coins = coins + ?, total_earnings = total_earnings + ?, updated_at = ?
         WHERE discord_id = ?`
      )
      .run(coins, coins, new Date().toISOString(), discordId);
  },

  addCoins(discordId: string, coins: number): void {
    getDB()
      .prepare(
        `UPDATE players SET coins = coins + ?, updated_at = ? WHERE discord_id = ?`
      )
      .run(coins, new Date().toISOString(), discordId);
  },

  addXPRaw(discordId: string, xp: number): void {
    getDB()
      .prepare(
        `UPDATE players
         SET xp = xp + ?, level = ((xp + ?) / 500) + 1, updated_at = ?
         WHERE discord_id = ?`
      )
      .run(xp, xp, new Date().toISOString(), discordId);
  }
};
