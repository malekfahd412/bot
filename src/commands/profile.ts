import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { generateProfileCard } from '../canvas/profile-card.js';
import { AchievementDB } from '../database/db.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your criminal profile card')
  .addUserOption(opt =>
    opt.setName('target').setDescription('View another player\'s profile').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const target = interaction.options.getUser('target') ?? interaction.user;
  const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });

  const player = PlayerSystem.getOrCreate(target.id, target.display_name, avatarUrl);
  const globalRank = PlayerSystem.getPlayerRank(target.id);

  try {
    const buffer = await generateProfileCard(player, globalRank);
    const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

    await interaction.editReply({
      content: target.id === interaction.user.id
        ? '> 🎯 Your criminal record, boss.'
        : `> 🎯 Criminal record for **${target.display_name}**.`,
      files: [attachment],
    });

    logger.info(`Profile card generated for ${target.display_name}`);
  } catch (err) {
    logger.error('Profile card generation failed:', err);
    await interaction.editReply('❌ Failed to generate profile card. Please try again.');
  }
}
