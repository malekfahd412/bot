import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { HeistSystem } from '../systems/heist.js';
import { logger } from '../utils/logger.js';
import { generateStatsCard } from '../canvas/stats-card.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your detailed criminal statistics')
  .addUserOption(opt =>
    opt
      .setName('target')
      .setDescription("View another player's stats")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const target = interaction.options.getUser('target') ?? interaction.user;

  const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });

  // FIX: الصحيح
  const username = target.displayName;

  const player = PlayerSystem.getOrCreate(
    target.id,
    username,
    avatarUrl
  );

  const recentHeists = HeistSystem.getPlayerHistory(target.id, 4);

  try {
    const buffer = await generateStatsCard(player, recentHeists);

    const attachment = new AttachmentBuilder(buffer, {
      name: 'stats.png',
    });

    await interaction.editReply({
      content:
        target.id === interaction.user.id
          ? '> 📊 Your full criminal dossier.'
          : `> 📊 Criminal dossier for **${username}**.`,

      files: [attachment],
    });

  } catch (err) {
    logger.error('Stats card generation failed:', err);
    await interaction.editReply('❌ Failed to generate stats card.');
  }
}