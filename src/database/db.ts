import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

import type { Player, HeistSubmission, Crew, Territory, Achievement, AdminLog, Season } from './schema.js';

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
    migrateSchema(db);
    seedTerritories(db);
    logger.success('Database ready');
  }
  return db;
}

/* ─────────────────────────── SCHEMA ─────────────────────────── */

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
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
      level INTEGER NOT NULL DEFAULT 1,
      bank_balance INTEGER NOT NULL DEFAULT 0,
      reputation INTEGER NOT NULL DEFAULT 0,
      territories_owned TEXT NOT NULL DEFAULT '[]',
      total_heists INTEGER NOT NULL DEFAULT 0,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      member_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS territories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      income_per_hour INTEGER NOT NULL DEFAULT 500,
      control_crew_id TEXT,
      risk_level TEXT NOT NULL DEFAULT 'medium',
      last_contested TEXT
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

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target TEXT,
      details TEXT,
      before_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      results TEXT
    );
  `);
}

/* ─────────────────────────── MIGRATIONS ─────────────────────────── */

function migrateSchema(database: Database.Database): void {
  const playerCols = (database.prepare('PRAGMA table_info(players)').all() as { name: string }[]).map(c => c.name);
  if (playerCols.includes('displayName') && !playerCols.includes('display_name')) {
    database.exec('ALTER TABLE players RENAME COLUMN displayName TO display_name');
    logger.info('Migration: players.displayName → players.display_name');
  }

  const crewCols = (database.prepare('PRAGMA table_info(crews)').all() as { name: string }[]).map(c => c.name);
  if (!crewCols.includes('level'))
    database.exec('ALTER TABLE crews ADD COLUMN level INTEGER NOT NULL DEFAULT 1');
  if (!crewCols.includes('bank_balance'))
    database.exec('ALTER TABLE crews ADD COLUMN bank_balance INTEGER NOT NULL DEFAULT 0');
  if (!crewCols.includes('reputation'))
    database.exec('ALTER TABLE crews ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0');
  if (!crewCols.includes('territories_owned'))
    database.exec("ALTER TABLE crews ADD COLUMN territories_owned TEXT NOT NULL DEFAULT '[]'");
  if (!crewCols.includes('total_heists'))
    database.exec('ALTER TABLE crews ADD COLUMN total_heists INTEGER NOT NULL DEFAULT 0');
  if (!crewCols.includes('icon_url'))
    database.exec('ALTER TABLE crews ADD COLUMN icon_url TEXT');
  if (!crewCols.includes('created_at'))
    database.exec("ALTER TABLE crews ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
}

/* ─────────────────────────── SEED TERRITORIES ─────────────────────────── */

function seedTerritories(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) as n FROM territories').get() as { n: number }).n;
  if (count > 0) return;

  const territories = [
    { id: 'downtown', name: 'Downtown', income_per_hour: 2000, risk_level: 'high' },
    { id: 'harbor', name: 'Harbor', income_per_hour: 1500, risk_level: 'medium' },
    { id: 'industrial', name: 'Industrial', income_per_hour: 1200, risk_level: 'medium' },
    { id: 'slums', name: 'Slums', income_per_hour: 800, risk_level: 'low' },
  ];

  const insert = database.prepare(
    'INSERT OR IGNORE INTO territories (id, name, income_per_hour, risk_level) VALUES (?, ?, ?, ?)'
  );
  for (const t of territories) insert.run(t.id, t.name, t.income_per_hour, t.risk_level);
  logger.info('Territories seeded (4 zones)');
}

/* ─────────────────────────── PLAYER DB ─────────────────────────── */

export const PlayerDB = {
  findByDiscordId(id: string): Player | undefined {
    return getDB().prepare('SELECT * FROM players WHERE discord_id = ?').get(id) as Player | undefined;
  },

  create(discord_id: string, display_name: string, avatar_url?: string): Player {
    const id = uuidv4();
    getDB().prepare(
      'INSERT INTO players (id, discord_id, display_name, avatar_url) VALUES (?, ?, ?, ?)'
    ).run(id, discord_id, display_name, avatar_url ?? null);
    return this.findByDiscordId(discord_id)!;
  },

  findOrCreate(id: string, display_name: string, avatar?: string): Player {
    return this.findByDiscordId(id) ?? this.create(id, display_name, avatar);
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

  addXP(id: string, xp: number): { newXP: number; newLevel: number; leveledUp: boolean } {
    const p = this.findByDiscordId(id)!;
    const newXP = p.xp + xp;
    const newLevel = Math.floor(newXP / 500) + 1;
    const leveledUp = newLevel > p.level;
    getDB()
      .prepare(`UPDATE players SET xp = ?, level = ?, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(newXP, newLevel, id);
    return { newXP, newLevel, leveledUp };
  },

  addCoins(id: string, coins: number): void {
    getDB()
      .prepare(`UPDATE players SET coins = coins + ?, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(coins, id);
  },

  addEarnings(id: string, coins: number): void {
    getDB()
      .prepare(`UPDATE players SET coins = coins + ?, total_earnings = total_earnings + ?, updated_at = datetime('now') WHERE discord_id = ?`)
      .run(coins, coins, id);
  },

  getLeaderboard(limit = 10): Player[] {
    return getDB().prepare('SELECT * FROM players ORDER BY xp DESC LIMIT ?').all(limit) as Player[];
  },

  getLeaderboardByCoins(limit = 10): Player[] {
    return getDB().prepare('SELECT * FROM players ORDER BY coins DESC LIMIT ?').all(limit) as Player[];
  },

  getRank(id: string): number {
    const r = getDB()
      .prepare('SELECT COUNT(*) + 1 as rank FROM players WHERE xp > (SELECT xp FROM players WHERE discord_id = ?)')
      .get(id) as { rank: number };
    return r.rank;
  },

  countAll(): number {
    return (getDB().prepare('SELECT COUNT(*) as n FROM players').get() as { n: number }).n;
  },
};

/* ─────────────────────────── HEIST DB ─────────────────────────── */

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
    getDB().prepare(
      'INSERT INTO heist_submissions (id, submitter_id, heist_name, difficulty, teammates, proof_url, notes, submission_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.submitter_id, data.heist_name, data.difficulty, data.teammates, data.proof_url, data.notes, data.submission_channel_id ?? null);
    return this.findById(id)!;
  },

  findById(id: string): HeistSubmission | undefined {
    return getDB().prepare('SELECT * FROM heist_submissions WHERE id = ?').get(id) as HeistSubmission | undefined;
  },

  findPending(): HeistSubmission[] {
    return getDB().prepare("SELECT * FROM heist_submissions WHERE status = 'pending' ORDER BY created_at ASC").all() as HeistSubmission[];
  },

  approve(id: string, reviewerId: string, note?: string): void {
    getDB().prepare(
      "UPDATE heist_submissions SET status = 'approved', reviewer_id = ?, reviewer_note = ?, reviewed_at = datetime('now') WHERE id = ?"
    ).run(reviewerId, note ?? null, id);
  },

  reject(id: string, reviewerId: string, note?: string): void {
    getDB().prepare(
      "UPDATE heist_submissions SET status = 'rejected', reviewer_id = ?, reviewer_note = ?, reviewed_at = datetime('now') WHERE id = ?"
    ).run(reviewerId, note ?? null, id);
  },

  setAwardedAmounts(id: string, xp: number, coins: number): void {
    getDB().prepare('UPDATE heist_submissions SET xp_awarded = ?, coins_awarded = ? WHERE id = ?').run(xp, coins, id);
  },

  setReviewMessageId(id: string, msg: string): void {
    getDB().prepare('UPDATE heist_submissions SET review_message_id = ? WHERE id = ?').run(msg, id);
  },

  getPlayerHistory(id: string, limit = 10): HeistSubmission[] {
    return getDB().prepare('SELECT * FROM heist_submissions WHERE submitter_id = ? ORDER BY created_at DESC LIMIT ?').all(id, limit) as HeistSubmission[];
  },

  countPending(): number {
    return (getDB().prepare("SELECT COUNT(*) as n FROM heist_submissions WHERE status = 'pending'").get() as { n: number }).n;
  },
};

/* ─────────────────────────── CREW DB ─────────────────────────── */

export const CrewDB = {
  create(name: string, tag: string, owner: string, desc?: string): Crew {
    const id = uuidv4();
    getDB().prepare('INSERT INTO crews (id, name, tag, owner_id, description) VALUES (?, ?, ?, ?, ?)').run(id, name, tag, owner, desc ?? null);
    return this.findById(id)!;
  },

  findById(id: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE id = ?').get(id) as Crew | undefined;
  },

  findByName(name: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE LOWER(name) = LOWER(?)').get(name) as Crew | undefined;
  },

  findByTag(tag: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE UPPER(tag) = UPPER(?)').get(tag) as Crew | undefined;
  },

  findByOwner(ownerId: string): Crew | undefined {
    return getDB().prepare('SELECT * FROM crews WHERE owner_id = ?').get(ownerId) as Crew | undefined;
  },

  update(id: string, data: Partial<Omit<Crew, 'id' | 'created_at'>>): void {
    const keys = Object.keys(data);
    if (!keys.length) return;
    const set = keys.map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    getDB().prepare(`UPDATE crews SET ${set} WHERE id = ?`).run(...values, id);
  },

  addMember(crewId: string, discordId: string): void {
    PlayerDB.update(discordId, { crew_id: crewId });
    getDB().prepare('UPDATE crews SET member_count = member_count + 1 WHERE id = ?').run(crewId);
  },

  removeMember(crewId: string, discordId: string): void {
    PlayerDB.update(discordId, { crew_id: null });
    getDB().prepare('UPDATE crews SET member_count = MAX(0, member_count - 1) WHERE id = ?').run(crewId);
  },

  getMembers(crewId: string): Player[] {
    return getDB().prepare('SELECT * FROM players WHERE crew_id = ?').all(crewId) as Player[];
  },

  depositToBank(crewId: string, amount: number): void {
    getDB().prepare('UPDATE crews SET bank_balance = bank_balance + ? WHERE id = ?').run(amount, crewId);
  },

  addReputation(crewId: string, amount: number): void {
    getDB().prepare('UPDATE crews SET reputation = reputation + ? WHERE id = ?').run(amount, crewId);
    const crew = this.findById(crewId);
    if (crew) {
      const newLevel = Math.floor(crew.reputation / 1000) + 1;
      if (newLevel > crew.level)
        getDB().prepare('UPDATE crews SET level = ? WHERE id = ?').run(newLevel, crewId);
    }
  },

  recordHeistEarnings(crewId: string, coins: number): void {
    getDB().prepare('UPDATE crews SET total_earnings = total_earnings + ?, total_heists = total_heists + 1 WHERE id = ?').run(coins, crewId);
  },

  setTerritoriesOwned(crewId: string, territories: string[]): void {
    getDB().prepare('UPDATE crews SET territories_owned = ? WHERE id = ?').run(JSON.stringify(territories), crewId);
  },

  getLeaderboard(limit = 10): Crew[] {
    return getDB().prepare('SELECT * FROM crews ORDER BY total_earnings DESC LIMIT ?').all(limit) as Crew[];
  },

  getAllCrews(): Crew[] {
    return getDB().prepare('SELECT * FROM crews ORDER BY total_earnings DESC').all() as Crew[];
  },

  countAll(): number {
    return (getDB().prepare('SELECT COUNT(*) as n FROM crews').get() as { n: number }).n;
  },
};

/* ─────────────────────────── TERRITORY DB ─────────────────────────── */

export const TerritoryDB = {
  getAll(): Territory[] {
    return getDB().prepare('SELECT * FROM territories').all() as Territory[];
  },

  findById(id: string): Territory | undefined {
    return getDB().prepare('SELECT * FROM territories WHERE id = ?').get(id) as Territory | undefined;
  },

  findByName(name: string): Territory | undefined {
    return getDB().prepare('SELECT * FROM territories WHERE LOWER(name) = LOWER(?)').get(name) as Territory | undefined;
  },

  setControl(territoryId: string, crewId: string | null): void {
    getDB()
      .prepare("UPDATE territories SET control_crew_id = ?, last_contested = datetime('now') WHERE id = ?")
      .run(crewId, territoryId);
  },

  getControlledBy(crewId: string): Territory[] {
    return getDB().prepare('SELECT * FROM territories WHERE control_crew_id = ?').all(crewId) as Territory[];
  },

  resetAllControl(): void {
    getDB().prepare('UPDATE territories SET control_crew_id = NULL, last_contested = NULL').run();
  },
};

/* ─────────────────────────── ACHIEVEMENT DB ─────────────────────────── */

export const AchievementDB = {
  unlock(player: string, key: string, name: string, desc: string, icon: string): boolean {
    try {
      getDB().prepare(
        'INSERT OR IGNORE INTO achievements (id, player_id, achievement_key, achievement_name, description, icon) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), player, key, name, desc, icon);
      return true;
    } catch {
      return false;
    }
  },

  getPlayerAchievements(id: string): Achievement[] {
    return getDB().prepare('SELECT * FROM achievements WHERE player_id = ? ORDER BY unlocked_at DESC').all(id) as Achievement[];
  },
};

/* ─────────────────────────── ADMIN LOG DB ─────────────────────────── */

export const AdminLogDB = {
  insert(data: {
    admin_id: string;
    action_type: string;
    target: string | null;
    details: string | null;
    before_snapshot: string | null;
  }): void {
    getDB().prepare(
      'INSERT INTO admin_logs (id, admin_id, action_type, target, details, before_snapshot) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), data.admin_id, data.action_type, data.target, data.details, data.before_snapshot);
  },

  getRecent(limit = 20): AdminLog[] {
    return getDB()
      .prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as AdminLog[];
  },
};

/* ─────────────────────────── SEASON DB ─────────────────────────── */

export const SeasonDB = {
  create(name: string): Season {
    const result = getDB()
      .prepare("INSERT INTO seasons (name, status) VALUES (?, 'active')")
      .run(name);
    return this.findById(result.lastInsertRowid as number)!;
  },

  findById(id: number): Season | undefined {
    return getDB().prepare('SELECT * FROM seasons WHERE id = ?').get(id) as Season | undefined;
  },

  getActive(): Season | undefined {
    return getDB().prepare("SELECT * FROM seasons WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get() as Season | undefined;
  },

  end(id: number, results: string): void {
    getDB()
      .prepare("UPDATE seasons SET status = 'ended', ended_at = datetime('now'), results = ? WHERE id = ?")
      .run(results, id);
  },

  getRecent(limit = 10): Season[] {
    return getDB()
      .prepare('SELECT * FROM seasons ORDER BY started_at DESC LIMIT ?')
      .all(limit) as Season[];
  },
};
