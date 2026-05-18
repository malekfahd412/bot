import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { generateProfileCard } from '../canvas/profile-card.js';
import { t } from '../utils/i18n.js';
import { logger } from '../utils/logger.js';
import { maybeShowLanguagePicker } from '../interactions/languageSelect.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your criminal profile card')
  .addUserOption(opt =>
    opt.setName('target').setDescription('View another player\'s profile').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const target    = interaction.options.getUser('target') ?? interaction.user;
  const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });

  const player = PlayerSystem.getOrCreate(target.id, target.displayName, avatarUrl);

  if (target.id === interaction.user.id) {
    await maybeShowLanguagePicker(interaction, interaction.user.id);
  }

  const lang        = PlayerDB.getLanguage(interaction.user.id);
  const globalRank  = PlayerSystem.getPlayerRank(target.id);

  try {
    const buffer     = await generateProfileCard(player, globalRank);
    const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

    const content = target.id === interaction.user.id
      ? t(lang, 'commands.profile.your_card')
      : t(lang, 'commands.profile.other_card', { name: target.displayName });

    await interaction.editReply({ content, files: [attachment] });
    logger.info(`Profile card generated for ${target.displayName}`);
  } catch (err) {
    logger.error('Profile card generation failed:', err);
    await interaction.editReply(t(lang, 'commands.profile.error'));
  }
}
