"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const profile_card_js_1 = require("../canvas/profile-card.js");
const db_js_1 = require("../database/db.js");
const logger_js_1 = require("../utils/logger.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your criminal profile card')
    .addUserOption(opt => opt.setName('target').setDescription('View another player\'s profile').setRequired(false));
async function execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('target') ?? interaction.user;
    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });
    const player = player_js_1.PlayerSystem.getOrCreate(target.id, target.username, avatarUrl);
    const globalRank = player_js_1.PlayerSystem.getPlayerRank(target.id);
    try {
        const buffer = await (0, profile_card_js_1.generateProfileCard)(player, globalRank);
        const attachment = new discord_js_1.AttachmentBuilder(buffer, { name: 'profile.png' });
        await interaction.editReply({
            content: target.id === interaction.user.id
                ? '> 🎯 Your criminal record, boss.'
                : `> 🎯 Criminal record for **${target.username}**.`,
            files: [attachment],
        });
        logger_js_1.logger.info(`Profile card generated for ${target.username}`);
    }
    catch (err) {
        logger_js_1.logger.error('Profile card generation failed:', err);
        await interaction.editReply('❌ Failed to generate profile card. Please try again.');
    }
}
//# sourceMappingURL=profile.js.map