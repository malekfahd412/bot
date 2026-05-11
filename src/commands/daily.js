"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const streaks_js_1 = require("../systems/streaks.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const logger_js_1 = require("../utils/logger.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward and keep your streak alive');
async function execute(interaction) {
    await interaction.deferReply();
    const user = interaction.user;
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
    player_js_1.PlayerSystem.getOrCreate(user.id, user.username, avatarUrl);
    try {
        const result = streaks_js_1.StreakSystem.claimDaily(user.id);
        const streakDisplay = result.newStreak >= 7 ? `${result.newStreak} 🔥🔥` :
            result.newStreak >= 3 ? `${result.newStreak} 🔥` :
                `${result.newStreak} 🔥`;
        const nextMilestone = streaks_js_1.StreakSystem.getNextMilestone(result.newStreak);
        const multiplier = streaks_js_1.StreakSystem.getStreakMultiplier(result.newStreak);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(result.streakBroken ? 0xff4757 : 0xC8A951)
            .setTitle(result.streakBroken ? '💔 Streak Reset' : result.milestoneReached ? `🎉 STREAK MILESTONE — ${result.milestone} DAYS!` : '💰 Daily Payday')
            .setDescription(result.streakBroken
            ? `Your streak was broken. Starting fresh from **1 day**.`
            : `You showed up. The crew respects that, **${user.username}**.`)
            .addFields({ name: '⚡ XP Earned', value: `+${(0, helpers_js_1.formatNumber)(result.xp)} XP`, inline: true }, { name: '💵 Coins Earned', value: (0, helpers_js_1.formatCoins)(result.coins), inline: true }, { name: '🔥 Current Streak', value: streakDisplay, inline: true }, { name: '📈 Streak Multiplier', value: `${multiplier.toFixed(1)}x`, inline: true }, ...(nextMilestone ? [{ name: '🎯 Next Milestone', value: `${nextMilestone - result.newStreak} days away`, inline: true }] : []))
            .setFooter({ text: 'Come back tomorrow to keep your streak going.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        if (err instanceof Error && err.message === 'ALREADY_CLAIMED') {
            await interaction.editReply({
                content: '⏰ You already claimed your daily reward today. Come back tomorrow, boss.',
            });
            return;
        }
        logger_js_1.logger.error('Daily claim failed:', err);
        await interaction.editReply('❌ Something went wrong. Try again.');
    }
}
//# sourceMappingURL=daily.js.map