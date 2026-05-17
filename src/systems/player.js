"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerSystem = void 0;
const db_js_1 = require("../database/db.js");
const helpers_js_1 = require("../utils/helpers.js");
const logger_js_1 = require("../utils/logger.js");
class PlayerSystem {
    static getOrCreate(discordId, display_name, avatarUrl) {
        return db_js_1.PlayerDB.findOrCreate(discordId, display_name, avatarUrl);
    }
    static get(discordId) {
        return db_js_1.PlayerDB.findByDiscordId(discordId);
    }
    static awardXP(discordId, amount) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player)
            throw new Error('Player not found');
        const oldRank = (0, helpers_js_1.getRank)(player.level);
        const { newLevel, leveledUp } = db_js_1.PlayerDB.addXP(discordId, amount);
        const newRank = (0, helpers_js_1.getRank)(newLevel);
        const rankChanged = newRank.name !== oldRank.name;
        if (leveledUp) {
            logger_js_1.logger.game(`${player.display_name} (${discordId}) leveled up to ${newLevel}`);
        }
        if (rankChanged) {
            logger_js_1.logger.game(`${player.display_name} (${discordId}) ranked up to ${newRank.name}`);
            db_js_1.PlayerDB.update(discordId, { rank: newRank.name });
            this.checkRankAchievement(discordId, newRank.name);
        }
        return { leveledUp, newLevel, newRank: rankChanged ? newRank.name : undefined, rankChanged };
    }
    // Awards coins and tracks total_earnings atomically in a single SQL call
    static awardCoins(discordId, amount) {
        db_js_1.PlayerDB.addEarnings(discordId, amount);
    }
    // Admin-only: give coins without tracking as heist earnings
    static giveCoins(discordId, amount) {
        db_js_1.PlayerDB.addCoins(discordId, amount);
    }
    // Admin-only: directly set XP and recalculate level/rank
    static adminGiveXP(discordId, amount) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player)
            throw new Error('Player not found');
        const oldRank = (0, helpers_js_1.getRank)(player.level);
        db_js_1.PlayerDB.addXP(discordId, amount);
        const updated = db_js_1.PlayerDB.findByDiscordId(discordId);
        const newRank = (0, helpers_js_1.getRank)(updated.level);
        const rankChanged = newRank.name !== oldRank.name;
        if (rankChanged)
            db_js_1.PlayerDB.update(discordId, { rank: newRank.name });
        return {
            leveledUp: updated.level > player.level,
            newLevel: updated.level,
            rankChanged,
            newRank: rankChanged ? newRank.name : undefined,
        };
    }
    static recordHeistResult(discordId, success, difficulty, heistName) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player)
            return;
        const updates = {
            total_heists: player.total_heists + 1,
            last_heist: new Date().toISOString(),
        };
        if (success) {
            updates.successful_heists = player.successful_heists + 1;
            const difficultyRank = ['easy', 'normal', 'hard'];
            const currentHardest = player.hardest_heist ?? 'easy';
            if (difficultyRank.indexOf(difficulty) > difficultyRank.indexOf(currentHardest)) {
                updates.hardest_heist = difficulty;
            }
            this.checkHeistAchievements(discordId, player.successful_heists + 1);
        }
        else {
            updates.failed_heists = player.failed_heists + 1;
        }
        db_js_1.PlayerDB.update(discordId, updates);
    }
    static checkRankAchievement(discordId, rank) {
        const rankAchievements = {
            ASSOCIATE: ['rank_associate', 'Made Man', 'Reached the rank of Associate', '🔫'],
            SOLDIER: ['rank_soldier', 'Street Soldier', 'Reached the rank of Soldier', '⚔️'],
            LIEUTENANT: ['rank_lieutenant', 'Rising Through the Ranks', 'Reached Lieutenant', '🎯'],
            BOSS: ['rank_boss', 'The Boss', 'Reached the rank of Boss', '👑'],
            KINGPIN: ['rank_kingpin', 'Kingpin', 'Reached the pinnacle — Kingpin', '💎'],
        };
        const entry = rankAchievements[rank];
        if (entry) {
            const [key, name, desc, icon] = entry;
            db_js_1.AchievementDB.unlock(discordId, key, name, desc, icon);
        }
    }
    static checkHeistAchievements(discordId, successfulHeists) {
        const milestones = {
            1: ['first_heist', 'First Score', 'Completed your first heist', '🎯'],
            10: ['heist_10', 'Seasoned Criminal', 'Completed 10 heists', '💼'],
            25: ['heist_25', 'Career Criminal', 'Completed 25 heists', '🔱'],
            50: ['heist_50', 'Crime Lord', 'Completed 50 heists', '👑'],
            100: ['heist_100', 'Legend of the Streets', 'Completed 100 heists', '💎'],
        };
        const milestone = milestones[successfulHeists];
        if (milestone) {
            const [key, name, desc, icon] = milestone;
            db_js_1.AchievementDB.unlock(discordId, key, name, desc, icon);
        }
    }
    static getLeaderboard(type = 'xp', limit = 10) {
        return type === 'xp' ? db_js_1.PlayerDB.getLeaderboard(limit) : db_js_1.PlayerDB.getLeaderboardByCoins(limit);
    }
    static getPlayerRank(discordId) {
        return db_js_1.PlayerDB.getRank(discordId);
    }
}
exports.PlayerSystem = PlayerSystem;
//# sourceMappingURL=player.js.map