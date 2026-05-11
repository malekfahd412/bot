"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const leaderboard_card_js_1 = require("../canvas/leaderboard-card.js");
const logger_js_1 = require("../utils/logger.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top criminals in the underworld')
    .addStringOption(opt => opt.setName('type')
    .setDescription('Sort by XP or Coins')
    .setRequired(false)
    .addChoices({ name: '⚔️ XP (Default)', value: 'xp' }, { name: '💰 Coins', value: 'coins' }));
async function execute(interaction) {
    await interaction.deferReply();
    const type = (interaction.options.getString('type') ?? 'xp');
    const players = player_js_1.PlayerSystem.getLeaderboard(type, 10);
    if (players.length === 0) {
        await interaction.editReply('📭 No players on record yet. Be the first to make your mark.');
        return;
    }
    try {
        const buffer = await (0, leaderboard_card_js_1.generateLeaderboardCard)(players, type);
        const attachment = new discord_js_1.AttachmentBuilder(buffer, { name: 'leaderboard.png' });
        await interaction.editReply({
            content: `> 🏆 **MOST WANTED** — Top ${players.length} criminals ranked by ${type === 'xp' ? 'XP' : 'Coins'}.`,
            files: [attachment],
        });
    }
    catch (err) {
        logger_js_1.logger.error('Leaderboard card generation failed:', err);
        await interaction.editReply('❌ Failed to generate leaderboard. Please try again.');
    }
}
//# sourceMappingURL=leaderboard.js.map