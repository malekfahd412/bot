import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { HeistSystem } from '../systems/heist.js';
import { t } from '../utils/i18n.js';
import { logger } from '../utils/logger.js';
import { generateStatsCard } from '../canvas/stats-card.js';
import { maybeShowLanguagePicker } from '../interactions/languageSelect.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your detailed criminal statistics')
  .addUserOption(opt =>
    opt.setName('target').setDescription("View another player's stats").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const target      = interaction.options.getUser('target') ?? interaction.user;
  const displayName = target.displayName;
  const avatarUrl   = target.displayAvatarURL({ extension: 'png', size: 256 });

  PlayerSystem.getOrCreate(target.id, displayName, avatarUrl);

  if (target.id === interaction.user.id) {
    await maybeShowLanguagePicker(interaction, interaction.user.id);
  }

  const lang         = PlayerDB.getLanguage(interaction.user.id);
  const player       = PlayerSystem.getOrCreate(target.id, displayName, avatarUrl);
  const recentHeists = HeistSystem.getPlayerHistory(target.id, 4);

  try {
    const buffer = await generateStatsCard(player, recentHeists);

    const content = target.id === interaction.user.id
      ? t(lang, 'commands.stats.your_dossier')
      : t(lang, 'commands.stats.other_dossier', { name: displayName });

    await interaction.editReply({
      content,
      files: [new AttachmentBuilder(buffer, { name: 'stats.png' })],
    });
  } catch (err) {
    logger.error('Stats card generation failed:', err);
    await interaction.editReply(t(lang, 'commands.stats.error'));
  }
}
