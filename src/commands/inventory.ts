import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { PlayerDB, AchievementDB } from '../database/db.js';
import { t } from '../utils/i18n.js';
import { getRank } from '../utils/helpers.js';
import { maybeShowLanguagePicker } from '../interactions/languageSelect.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your achievements, badges, and inventory');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const user         = interaction.user;
  const avatarUrl    = user.displayAvatarURL({ extension: 'png', size: 256 });
  const player       = PlayerSystem.getOrCreate(user.id, user.displayName, avatarUrl);
  const achievements = AchievementDB.getPlayerAchievements(user.id);
  const rank         = getRank(player.level);

  await maybeShowLanguagePicker(interaction, user.id);
  const lang = PlayerDB.getLanguage(user.id);

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(t(lang, 'commands.inventory.title', { name: user.displayName }))
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: t(lang, 'commands.inventory.rank_field'),  value: `${rank.icon} **${rank.name}**`,       inline: true },
      { name: t(lang, 'commands.inventory.level_field'), value: `**${player.level}**`,                  inline: true },
      { name: t(lang, 'commands.inventory.coins_field'), value: `**$${player.coins.toLocaleString()}**`, inline: true },
    );

  if (achievements.length > 0) {
    const achDisplay = achievements.slice(0, 12).map(a =>
      `${a.icon} **${a.achievement_name}**\n${a.description}`
    ).join('\n\n');

    embed.addFields({
      name:  t(lang, 'commands.inventory.achievements_title', { count: achievements.length }),
      value: achDisplay.length > 1024 ? achDisplay.slice(0, 1021) + '...' : achDisplay,
    });
  } else {
    embed.addFields({
      name:  t(lang, 'commands.inventory.achievements_empty_title'),
      value: t(lang, 'commands.inventory.achievements_empty_value'),
    });
  }

  embed
    .setFooter({ text: t(lang, 'commands.inventory.footer') })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
