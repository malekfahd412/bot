import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { t } from '../utils/i18n.js';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Set your preferred language / اختر لغتك المفضلة');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.user;
  PlayerSystem.getOrCreate(user.id, user.displayName, user.displayAvatarURL({ extension: 'png', size: 256 }));

  const currentLang = PlayerDB.getLanguage(user.id);
  const currentLabel = currentLang === 'ar' ? 'العربية' : 'English';

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(t('en', 'common.language.picker_title'))
    .setDescription(
      t('en', 'common.language.picker_desc') +
      `\n\n${t('en', 'common.language.current', { lang: currentLabel })}`
    )
    .setFooter({ text: 'GTA Heist RPG' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lang_set:en')
      .setLabel(t('en', 'common.language.btn_english'))
      .setStyle(currentLang === 'en' ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('lang_set:ar')
      .setLabel(t('en', 'common.language.btn_arabic'))
      .setStyle(currentLang === 'ar' ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
