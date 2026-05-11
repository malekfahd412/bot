"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeistSystem = void 0;
const db_js_1 = require("../database/db.js");
const constants_js_1 = require("../utils/constants.js");
const logger_js_1 = require("../utils/logger.js");
class HeistSystem {
    static submit(data) {
        const submission = db_js_1.HeistDB.create({
            submitter_id: data.submitterId,
            heist_name: data.heistName,
            difficulty: data.difficulty,
            teammates: JSON.stringify(data.teammates),
            proof_url: data.proofUrl,
            notes: data.notes ?? null,
            submission_channel_id: data.submissionChannelId ?? null,
        });
        logger_js_1.logger.game(`Heist submission created: ${submission.id} by ${data.submitterId}`);
        return submission;
    }
    static getPendingSubmissions() {
        return db_js_1.HeistDB.findPending();
    }
    static getSubmission(id) {
        return db_js_1.HeistDB.findById(id);
    }
    static getPlayerHistory(discordId, limit = 10) {
        return db_js_1.HeistDB.getPlayerHistory(discordId, limit);
    }
    static calculateRewards(difficulty) {
        const config = constants_js_1.DIFFICULTY_CONFIG[difficulty];
        const xpVariance = Math.floor(Math.random() * 50) - 25;
        const coinVariance = Math.floor(Math.random() * 200) - 100;
        return {
            xp: Math.max(config.xp + xpVariance, 10),
            coins: Math.max(config.coins + coinVariance, 100),
        };
    }
    static getTeammates(submission) {
        try {
            return JSON.parse(submission.teammates);
        }
        catch {
            return [];
        }
    }
    static setReviewMessage(id, messageId) {
        db_js_1.HeistDB.setReviewMessageId(id, messageId);
    }
    static getDifficultyConfig(difficulty) {
        return constants_js_1.DIFFICULTY_CONFIG[difficulty];
    }
}
exports.HeistSystem = HeistSystem;
//# sourceMappingURL=heist.js.map