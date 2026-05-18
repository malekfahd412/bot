import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { StreakSystem } from '../systems/streaks.js';
import { t } from '../utils/i18n.js';
import { formatCoins, formatNumber } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { maybeShowLanguagePicker } from '../interactions/languageSelect.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward and keep your streak alive');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const user = interaction.user;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });

  PlayerSystem.getOrCreate(user.id, user.displayName, avatarUrl);
  await maybeShowLanguagePicker(interaction, user.id);

  const lang = PlayerDB.getLanguage(user.id);

  try {
    const result = StreakSystem.claimDaily(user.id);

    const streakDisplay = result.newStreak >= 7 ? `${result.newStreak} 🔥🔥` :
                          result.newStreak >= 3 ? `${result.newStreak} 🔥` :
                          `${result.newStreak} 🔥`;

    const nextMilestone = StreakSystem.getNextMilestone(result.newStreak);
    const multiplier    = StreakSystem.getStreakMultiplier(result.newStreak);

    const title = result.streakBroken
      ? t(lang, 'commands.daily.broken_title')
      : result.milestoneReached
        ? t(lang, 'commands.daily.milestone_title', { days: String(result.milestone) })
        : t(lang, 'commands.daily.normal_title');

    const desc = result.streakBroken
      ? t(lang, 'commands.daily.broken_desc')
      : t(lang, 'commands.daily.normal_desc', { name: user.displayName });

    const embed = new EmbedBuilder()
      .setColor(result.streakBroken ? 0xff4757 : 0xC8A951)
      .setTitle(title)
      .setDescription(desc)
      .addFields(
        { name: t(lang, 'commands.daily.xp_field'),         value: `+${formatNumber(result.xp)} XP`,    inline: true },
        { name: t(lang, 'commands.daily.coins_field'),      value: formatCoins(result.coins),            inline: true },
        { name: t(lang, 'commands.daily.streak_field'),     value: streakDisplay,                        inline: true },
        { name: t(lang, 'commands.daily.multiplier_field'), value: `${multiplier.toFixed(1)}x`,          inline: true },
        ...(nextMilestone
          ? [{ name: t(lang, 'commands.daily.milestone_field'), value: t(lang, 'commands.daily.milestone_value', { days: String(nextMilestone - result.newStreak) }), inline: true }]
          : []),
      )
      .setFooter({ text: t(lang, 'commands.daily.footer') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_CLAIMED') {
      await interaction.editReply({ content: t(lang, 'commands.daily.already_claimed') });
      return;
    }
    logger.error('Daily claim failed:', err);
    await interaction.editReply(t(lang, 'commands.daily.error'));
  }
}
