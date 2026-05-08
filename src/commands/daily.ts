import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { StreakSystem } from '../systems/streaks.js';
import { formatCoins, formatNumber } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward and keep your streak alive');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const user = interaction.user;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });

  PlayerSystem.getOrCreate(user.id, user.username, avatarUrl);

  try {
    const result = StreakSystem.claimDaily(user.id);

    const nextMilestone = StreakSystem.getNextMilestone(result.newStreak);
    const multiplier = StreakSystem.getStreakMultiplier(result.newStreak);

    const embed = new EmbedBuilder()
      .setColor(result.streakBroken ? 0xff4757 : 0xC8A951)
      .setTitle(
        result.streakBroken
          ? '💔 Streak Reset'
          : result.milestoneReached
            ? `🎉 STREAK MILESTONE — ${result.milestone} DAYS!`
            : '💰 Daily Payday'
      )
      .setDescription(
        result.streakBroken
          ? 'Your streak was broken. Starting fresh.'
          : `Welcome back **${user.username}**`
      )
      .addFields(
        { name: 'XP', value: `+${formatNumber(result.xp)} XP`, inline: true },
        { name: 'Coins', value: formatCoins(result.coins), inline: true },
        { name: 'Streak', value: `${result.newStreak} 🔥`, inline: true },
        { name: 'Multiplier', value: `${multiplier.toFixed(1)}x`, inline: true },
        ...(nextMilestone
          ? [{
              name: 'Next Milestone',
              value: `${nextMilestone - result.newStreak} days left`,
              inline: true,
            }]
          : []),
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err: any) {
    if (err.message === 'ALREADY_CLAIMED') {
      await interaction.editReply('⏰ You already claimed daily today.');
      return;
    }

    logger.error('Daily error:', err);
    await interaction.editReply('❌ Error occurred.');
  }
}
