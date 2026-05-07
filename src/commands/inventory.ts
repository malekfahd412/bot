import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { AchievementDB } from '../database/db.js';
import { COLORS } from '../utils/constants.js';
import { getRank } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your achievements, badges, and inventory');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(user.id, user.username, user.displayAvatarURL({ extension: 'png', size: 256 }));
  const achievements = AchievementDB.getPlayerAchievements(user.id);
  const rank = getRank(player.level);

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(`🎒 ${user.username}'s Inventory`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: '🏅 Rank', value: `${rank.icon} **${rank.name}**`, inline: true },
      { name: '📊 Level', value: `**${player.level}**`, inline: true },
      { name: '💰 Coins', value: `**$${player.coins.toLocaleString()}**`, inline: true },
    );

  if (achievements.length > 0) {
    const achDisplay = achievements.slice(0, 12).map(a =>
      `${a.icon} **${a.achievement_name}**\n${a.description}`
    ).join('\n\n');

    embed.addFields({
      name: `🏆 Achievements (${achievements.length})`,
      value: achDisplay.length > 1024 ? achDisplay.slice(0, 1021) + '...' : achDisplay,
    });
  } else {
    embed.addFields({
      name: '🏆 Achievements',
      value: '*No achievements yet. Complete heists to earn them.*',
    });
  }

  embed.setFooter({ text: `GTA Heist RPG • Complete heists to unlock achievements` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
