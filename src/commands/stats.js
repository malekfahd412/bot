"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const heist_js_1 = require("../systems/heist.js");
const stats_card_js_1 = require("../canvas/stats-card.js");
const logger_js_1 = require("../utils/logger.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your detailed criminal statistics')
    .addUserOption(opt => opt.setName('target').setDescription('View another player\'s stats').setRequired(false));
async function execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('target') ?? interaction.user;
    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });
    const player = player_js_1.PlayerSystem.getOrCreate(target.id, target.username, avatarUrl);
    const recentHeists = heist_js_1.HeistSystem.getPlayerHistory(target.id, 4);
    try {
        const buffer = await (0, stats_card_js_1.generateStatsCard)(player, recentHeists);
        const attachment = new discord_js_1.AttachmentBuilder(buffer, { name: 'stats.png' });
        await interaction.editReply({
            content: target.id === interaction.user.id
                ? '> 📊 Your full criminal dossier.'
                : `> 📊 Criminal dossier for **${target.username}**.`,
            files: [attachment],
        });
    }
    catch (err) {
        logger_js_1.logger.error('Stats card generation failed:', err);
        await interaction.editReply('❌ Failed to generate stats card. Please try again.');
    }
}
//# sourceMappingURL=stats.js.map