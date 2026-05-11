"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AchievementDB = exports.CrewDB = exports.HeistDB = exports.PlayerDB = void 0;
exports.getDB = getDB;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = require("path");
const fs_1 = require("fs");
const logger_js_1 = require("../utils/logger.js");
const uuid_1 = require("uuid");
const DATA_DIR = (0, path_1.join)(process.cwd(), 'data');
if (!(0, fs_1.existsSync)(DATA_DIR))
    (0, fs_1.mkdirSync)(DATA_DIR, { recursive: true });
const DB_PATH = (0, path_1.join)(DATA_DIR, 'game.db');
let db;
function getDB() {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema(db);
        logger_js_1.logger.success('Database initialized at ' + DB_PATH);
    }
    return db;
}
function initSchema(database) {
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

    CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);
    CREATE INDEX IF NOT EXISTS idx_players_xp ON players(xp DESC);
    CREATE INDEX IF NOT EXISTS idx_heist_status ON heist_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_heist_submitter ON heist_submissions(submitter_id);
  `);
}
exports.PlayerDB = {
    findByDiscordId(discordId) {
        return getDB().prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId);
    },
    create(discordId, username, avatarUrl) {
        const id = (0, uuid_1.v4)();
        getDB().prepare(`
      INSERT INTO players (id, discord_id, username, avatar_url)
      VALUES (?, ?, ?, ?)
    `).run(id, discordId, username, avatarUrl ?? null);
        return this.findByDiscordId(discordId);
    },
    findOrCreate(discordId, username, avatarUrl) {
        return this.findByDiscordId(discordId) ?? this.create(discordId, username, avatarUrl);
    },
    update(discordId, data) {
        if (Object.keys(data).length === 0)
            return;
        const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), new Date().toISOString(), discordId];
        getDB().prepare(`UPDATE players SET ${sets}, updated_at = ? WHERE discord_id = ?`).run(...values);
    },
    clearCrewId(discordId) {
        getDB().prepare("UPDATE players SET crew_id = NULL, updated_at = ? WHERE discord_id = ?")
            .run(new Date().toISOString(), discordId);
    },
    addXP(discordId, xp) {
        const player = this.findByDiscordId(discordId);
        const newXP = player.xp + xp;
        const newLevel = Math.floor(newXP / 500) + 1;
        const leveledUp = newLevel > player.level;
        this.update(discordId, { xp: newXP, level: newLevel });
        return { newXP, newLevel, leveledUp };
    },
    // Atomically add coins AND track total_earnings in a single SQL statement
    addEarnings(discordId, coins) {
        getDB().prepare(`
      UPDATE players
      SET coins = coins + ?, total_earnings = total_earnings + ?, updated_at = ?
      WHERE discord_id = ?
    `).run(coins, coins, new Date().toISOString(), discordId);
    },
    // Add coins without affecting total_earnings (admin gives, daily rewards, etc.)
    addCoins(discordId, coins) {
        getDB().prepare('UPDATE players SET coins = coins + ?, updated_at = ? WHERE discord_id = ?')
            .run(coins, new Date().toISOString(), discordId);
    },
    // Directly add XP without level recalculation (admin use)
    addXPRaw(discordId, xp) {
        getDB().prepare(`
      UPDATE players
      SET xp = xp + ?, level = (((xp + ?) / 500) + 1), updated_at = ?
      WHERE discord_id = ?
    `).run(xp, xp, new Date().toISOString(), discordId);
    },
    getLeaderboard(limit = 10) {
        return getDB().prepare('SELECT * FROM players ORDER BY xp DESC LIMIT ?').all(limit);
    },
    getLeaderboardByCoins(limit = 10) {
        return getDB().prepare('SELECT * FROM players ORDER BY coins DESC LIMIT ?').all(limit);
    },
    getRank(discordId) {
        const result = getDB().prepare(`
      SELECT COUNT(*) + 1 as rank FROM players WHERE xp > (
        SELECT xp FROM players WHERE discord_id = ?
      )
    `).get(discordId);
        return result.rank;
    },
};
exports.HeistDB = {
    create(data) {
        const id = (0, uuid_1.v4)();
        getDB().prepare(`
      INSERT INTO heist_submissions (id, submitter_id, heist_name, difficulty, teammates, proof_url, notes, submission_channel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.submitter_id, data.heist_name, data.difficulty, data.teammates, data.proof_url, data.notes, data.submission_channel_id);
        return this.findById(id);
    },
    findById(id) {
        return getDB().prepare('SELECT * FROM heist_submissions WHERE id = ?').get(id);
    },
    findPending() {
        return getDB().prepare("SELECT * FROM heist_submissions WHERE status = 'pending' ORDER BY created_at ASC").all();
    },
    approve(id, reviewerId, reviewNote) {
        getDB().prepare(`
      UPDATE heist_submissions
      SET status = 'approved', reviewer_id = ?, reviewer_note = ?, reviewed_at = ?
      WHERE id = ?
    `).run(reviewerId, reviewNote ?? null, new Date().toISOString(), id);
    },
    reject(id, reviewerId, reviewNote) {
        getDB().prepare(`
      UPDATE heist_submissions
      SET status = 'rejected', reviewer_id = ?, reviewer_note = ?, reviewed_at = ?
      WHERE id = ?
    `).run(reviewerId, reviewNote ?? null, new Date().toISOString(), id);
    },
    setAwardedAmounts(id, xp, coins) {
        getDB().prepare('UPDATE heist_submissions SET xp_awarded = ?, coins_awarded = ? WHERE id = ?').run(xp, coins, id);
    },
    setReviewMessageId(id, messageId) {
        getDB().prepare('UPDATE heist_submissions SET review_message_id = ? WHERE id = ?').run(messageId, id);
    },
    getPlayerHistory(discordId, limit = 10) {
        return getDB().prepare("SELECT * FROM heist_submissions WHERE submitter_id = ? ORDER BY created_at DESC LIMIT ?").all(discordId, limit);
    },
    countPending() {
        const result = getDB().prepare("SELECT COUNT(*) as c FROM heist_submissions WHERE status = 'pending'").get();
        return result.c;
    },
};
exports.CrewDB = {
    create(name, tag, ownerId, description) {
        const id = (0, uuid_1.v4)();
        getDB().prepare(`
      INSERT INTO crews (id, name, tag, owner_id, description) VALUES (?, ?, ?, ?, ?)
    `).run(id, name, tag, ownerId, description ?? null);
        exports.PlayerDB.update(ownerId, { crew_id: id });
        return this.findById(id);
    },
    findById(id) {
        return getDB().prepare('SELECT * FROM crews WHERE id = ?').get(id);
    },
    findByName(name) {
        return getDB().prepare('SELECT * FROM crews WHERE LOWER(name) = LOWER(?)').get(name);
    },
    findByTag(tag) {
        return getDB().prepare('SELECT * FROM crews WHERE LOWER(tag) = LOWER(?)').get(tag);
    },
    getMembers(crewId) {
        return getDB().prepare('SELECT * FROM players WHERE crew_id = ?').all(crewId);
    },
    addMember(crewId, discordId) {
        exports.PlayerDB.update(discordId, { crew_id: crewId });
        getDB().prepare('UPDATE crews SET member_count = member_count + 1 WHERE id = ?').run(crewId);
    },
    removeMember(crewId, discordId) {
        // Use dedicated clearCrewId to avoid null type hack
        exports.PlayerDB.clearCrewId(discordId);
        getDB().prepare('UPDATE crews SET member_count = MAX(0, member_count - 1) WHERE id = ?').run(crewId);
    },
    update(id, data) {
        if (Object.keys(data).length === 0)
            return;
        const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
        getDB().prepare(`UPDATE crews SET ${sets} WHERE id = ?`).run(...Object.values(data), id);
    },
    // Atomic increment for heist results — no read-modify-write race
    recordHeistEarnings(crewId, earnings) {
        getDB().prepare(`
      UPDATE crews SET total_heists = total_heists + 1, total_earnings = total_earnings + ? WHERE id = ?
    `).run(earnings, crewId);
    },
    getLeaderboard(limit = 10) {
        return getDB().prepare('SELECT * FROM crews ORDER BY total_earnings DESC LIMIT ?').all(limit);
    },
};
exports.AchievementDB = {
    unlock(playerId, key, name, description, icon) {
        try {
            getDB().prepare(`
        INSERT INTO achievements (id, player_id, achievement_key, achievement_name, description, icon)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run((0, uuid_1.v4)(), playerId, key, name, description, icon);
            return true;
        }
        catch {
            return false;
        }
    },
    getPlayerAchievements(playerId) {
        return getDB().prepare('SELECT * FROM achievements WHERE player_id = ? ORDER BY unlocked_at DESC').all(playerId);
    },
};
//# sourceMappingURL=db.js.map