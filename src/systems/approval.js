"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalSystem = void 0;
const db_js_1 = require("../database/db.js");
const player_js_1 = require("./player.js");
const heist_js_1 = require("./heist.js");
const crew_js_1 = require("./crew.js");
const logger_js_1 = require("../utils/logger.js");
class ApprovalSystem {
    static async approve(submissionId, reviewerId, reviewNote) {
        const submission = heist_js_1.HeistSystem.getSubmission(submissionId);
        if (!submission)
            throw new Error('Submission not found');
        if (submission.status !== 'pending')
            throw new Error(`This submission is already **${submission.status}**`);
        const difficulty = submission.difficulty;
        const { xp, coins } = heist_js_1.HeistSystem.calculateRewards(difficulty);
        db_js_1.HeistDB.approve(submissionId, reviewerId, reviewNote);
        db_js_1.HeistDB.setAwardedAmounts(submissionId, xp, coins);
        const teammates = heist_js_1.HeistSystem.getTeammates(submission);
        const allParticipants = [submission.submitter_id, ...teammates];
        const levelResults = [];
        const skippedTeammates = [];
        for (const discordId of allParticipants) {
            // Auto-register if this is a teammate who hasn't used the bot yet
            const existing = db_js_1.PlayerDB.findByDiscordId(discordId);
            if (!existing) {
                if (discordId === submission.submitter_id) {
                    // Submitter must be registered (they used /heist-log)
                    logger_js_1.logger.warn(`Submitter ${discordId} not found in DB — skipping rewards`);
                    skippedTeammates.push(discordId);
                    continue;
                }
                // Auto-create teammate with placeholder — they'll fill in their profile later
                db_js_1.PlayerDB.create(discordId, `Player-${discordId.slice(-5)}`);
                logger_js_1.logger.info(`Auto-registered teammate ${discordId} to distribute rewards`);
            }
            try {
                const levelResult = player_js_1.PlayerSystem.awardXP(discordId, xp);
                // awardCoins also increments total_earnings atomically
                player_js_1.PlayerSystem.awardCoins(discordId, coins);
                player_js_1.PlayerSystem.recordHeistResult(discordId, true, difficulty, submission.heist_name);
                levelResults.push({ discordId, ...levelResult });
                // Update crew stats if they're in one
                const player = db_js_1.PlayerDB.findByDiscordId(discordId);
                if (player?.crew_id) {
                    crew_js_1.CrewSystem.recordHeistResult(player.crew_id, coins);
                }
                logger_js_1.logger.game(`Rewarded ${discordId}: +${xp} XP, +${coins} coins`);
            }
            catch (err) {
                logger_js_1.logger.error(`Failed to reward ${discordId}:`, err);
                skippedTeammates.push(discordId);
            }
        }
        return {
            submission: db_js_1.HeistDB.findById(submissionId),
            xpAwarded: xp,
            coinsAwarded: coins,
            levelResults,
            skippedTeammates,
        };
    }
    static reject(submissionId, reviewerId, reviewNote) {
        const submission = heist_js_1.HeistSystem.getSubmission(submissionId);
        if (!submission)
            throw new Error('Submission not found');
        if (submission.status !== 'pending')
            throw new Error(`This submission is already **${submission.status}**`);
        db_js_1.HeistDB.reject(submissionId, reviewerId, reviewNote);
        // Record the failed heist on all known participants
        const teammates = heist_js_1.HeistSystem.getTeammates(submission);
        const allParticipants = [submission.submitter_id, ...teammates];
        for (const discordId of allParticipants) {
            const player = db_js_1.PlayerDB.findByDiscordId(discordId);
            if (!player)
                continue; // Don't auto-create for rejections
            try {
                player_js_1.PlayerSystem.recordHeistResult(discordId, false, submission.difficulty, submission.heist_name);
            }
            catch (err) {
                logger_js_1.logger.error(`Failed to record rejection for ${discordId}:`, err);
            }
        }
        return db_js_1.HeistDB.findById(submissionId);
    }
}
exports.ApprovalSystem = ApprovalSystem;
//# sourceMappingURL=approval.js.map