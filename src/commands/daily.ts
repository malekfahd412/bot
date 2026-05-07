import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { StreakSystem } from '../systems/streaks.js';
import { COLORS } from '../utils/constants.js';
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

    const streakDisplay = result.newStreak >= 7 ? `${result.newStreak} 🔥🔥` :
                          result.newStreak >= 3 ? `${result.newStreak} 🔥` :
                          `${result.newStreak} 🔥`;

    const nextMilestone = StreakSystem.getNextMilestone(result.newStreak);
    const multiplier = StreakSystem.getStreakMultiplier(result.newStreak);

    const embed = new EmbedBuilder()
      .setColor(result.streakBroken ? 0xff4757 : 0xC8A951)
      .setTitle(result.streakBroken ? '💔 Streak Reset' : result.milestoneReached ? `🎉 STREAK MILESTONE — ${result.milestone} DAYS!` : '💰 Daily Payday')
      .setDescription(result.streakBroken
        ? `Your streak was broken. Starting fresh from **1 day**.`
        : `You showed up. The crew respects that, **${user.username}**.`)
      .addFields(
        { name: '⚡ XP Earned', value: `+${formatNumber(result.xp)} XP`, inline: true },
        { name: '💵 Coins Earned', value: formatCoins(result.coins), inline: true },
        { name: '🔥 Current Streak', value: streakDisplay, inline: true },
        { name: '📈 Streak Multiplier', value: `${multiplier.toFixed(1)}x`, inline: true },
        ...(nextMilestone ? [{ name: '🎯 Next Milestone', value: `${nextMilestone - result.newStreak} days away`, inline: true }] : []),
      )
      .setFooter({ text: 'Come back tomorrow to keep your streak going.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_CLAIMED') {
      await interaction.editReply({
        content: '⏰ You already claimed your daily reward today. Come back tomorrow, boss.',
      });
      return;
    }
    logger.error('Daily claim failed:', err);
    await interaction.editReply('❌ Something went wrong. Try again.');
  }
}
