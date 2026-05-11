"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreakSystem = void 0;
const db_js_1 = require("../database/db.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
class StreakSystem {
    static claimDaily(discordId) {
        const player = db_js_1.PlayerDB.findByDiscordId(discordId);
        if (!player)
            throw new Error('Player not found');
        if (player.last_daily && (0, helpers_js_1.isToday)(player.last_daily)) {
            throw new Error('ALREADY_CLAIMED');
        }
        const streakBroken = player.last_daily ? !(0, helpers_js_1.isYesterday)(player.last_daily) : false;
        const newStreak = streakBroken ? 1 : player.streak_current + 1;
        const newLongest = Math.max(newStreak, player.streak_longest);
        const streakMultiplier = Math.min(1 + (newStreak - 1) * 0.1, 3.0);
        const xp = Math.floor(constants_js_1.DAILY_REWARD.xp * streakMultiplier);
        const coins = Math.floor(constants_js_1.DAILY_REWARD.coins * streakMultiplier);
        db_js_1.PlayerDB.update(discordId, {
            streak_current: newStreak,
            streak_longest: newLongest,
            last_daily: new Date().toISOString(),
        });
        db_js_1.PlayerDB.addXP(discordId, xp);
        db_js_1.PlayerDB.addCoins(discordId, coins);
        const milestoneReached = constants_js_1.STREAK_MILESTONES.includes(newStreak);
        return {
            xp,
            coins,
            newStreak,
            streakBroken,
            milestoneReached,
            milestone: milestoneReached ? newStreak : undefined,
        };
    }
    static getStreakMultiplier(streak) {
        return Math.min(1 + (streak - 1) * 0.1, 3.0);
    }
    static getNextMilestone(streak) {
        return constants_js_1.STREAK_MILESTONES.find(m => m > streak) ?? null;
    }
}
exports.StreakSystem = StreakSystem;
//# sourceMappingURL=streaks.js.map