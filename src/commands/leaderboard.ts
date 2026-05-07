import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { generateLeaderboardCard } from '../canvas/leaderboard-card.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top criminals in the underworld')
  .addStringOption(opt =>
    opt.setName('type')
      .setDescription('Sort by XP or Coins')
      .setRequired(false)
      .addChoices(
        { name: '⚔️ XP (Default)', value: 'xp' },
        { name: '💰 Coins', value: 'coins' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const type = (interaction.options.getString('type') ?? 'xp') as 'xp' | 'coins';
  const players = PlayerSystem.getLeaderboard(type, 10);

  if (players.length === 0) {
    await interaction.editReply('📭 No players on record yet. Be the first to make your mark.');
    return;
  }

  try {
    const buffer = await generateLeaderboardCard(players, type);
    const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

    await interaction.editReply({
      content: `> 🏆 **MOST WANTED** — Top ${players.length} criminals ranked by ${type === 'xp' ? 'XP' : 'Coins'}.`,
      files: [attachment],
    });
  } catch (err) {
    logger.error('Leaderboard card generation failed:', err);
    await interaction.editReply('❌ Failed to generate leaderboard. Please try again.');
  }
}
