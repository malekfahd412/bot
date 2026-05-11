"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const db_js_1 = require("../database/db.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your achievements, badges, and inventory');
async function execute(interaction) {
    await interaction.deferReply();
    const user = interaction.user;
    const player = player_js_1.PlayerSystem.getOrCreate(user.id, user.username, user.displayAvatarURL({ extension: 'png', size: 256 }));
    const achievements = db_js_1.AchievementDB.getPlayerAchievements(user.id);
    const rank = (0, helpers_js_1.getRank)(player.level);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xC8A951)
        .setTitle(`🎒 ${user.username}'s Inventory`)
        .setThumbnail(user.displayAvatarURL())
        .addFields({ name: '🏅 Rank', value: `${rank.icon} **${rank.name}**`, inline: true }, { name: '📊 Level', value: `**${player.level}**`, inline: true }, { name: '💰 Coins', value: `**$${player.coins.toLocaleString()}**`, inline: true });
    if (achievements.length > 0) {
        const achDisplay = achievements.slice(0, 12).map(a => `${a.icon} **${a.achievement_name}**\n${a.description}`).join('\n\n');
        embed.addFields({
            name: `🏆 Achievements (${achievements.length})`,
            value: achDisplay.length > 1024 ? achDisplay.slice(0, 1021) + '...' : achDisplay,
        });
    }
    else {
        embed.addFields({
            name: '🏆 Achievements',
            value: '*No achievements yet. Complete heists to earn them.*',
        });
    }
    embed.setFooter({ text: `GTA Heist RPG • Complete heists to unlock achievements` })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
//# sourceMappingURL=inventory.js.map