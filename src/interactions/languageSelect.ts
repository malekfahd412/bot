import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { PlayerDB } from '../database/db.js';
import { t, type SupportedLang } from '../utils/i18n.js';

/* ─────────────────────────────────────────────────────────────────────────
   LANGUAGE SELECTION PANEL
   - maybeShowLanguagePicker: called by commands when a player is new
     (language IS NULL). Sends an ephemeral followUp embed with EN/AR buttons.
   - handleLanguageSelect: called by the interaction router when a
     `lang_set:xx` button is pressed.
───────────────────────────────────────────────────────────────────────── */

/** Sends the ephemeral language picker to a player who hasn't chosen yet. */
export async function maybeShowLanguagePicker(
  interaction: ChatInputCommandInteraction,
  discordId: string
): Promise<void> {
  if (!PlayerDB.isLanguageUnset(discordId)) return;

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(t('en', 'common.language.picker_title'))
    .setDescription(t('en', 'common.language.picker_desc'))
    .setFooter({ text: 'GTA Heist RPG' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lang_set:en')
      .setLabel(t('en', 'common.language.btn_english'))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('lang_set:ar')
      .setLabel(t('en', 'common.language.btn_arabic'))
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true }).catch(() => null);
}

/** Handles `lang_set:en` / `lang_set:ar` button interactions. */
export async function handleLanguageSelect(button: ButtonInteraction): Promise<void> {
  const lang = button.customId.split(':')[1] as SupportedLang;

  if (lang !== 'en' && lang !== 'ar') {
    await button.reply({ content: '❌ Invalid language selection.', ephemeral: true }).catch(() => null);
    return;
  }

  PlayerDB.setLanguage(button.user.id, lang);

  const confirmMsg = lang === 'ar'
    ? t('ar', 'common.language.saved_ar')
    : t('en', 'common.language.saved_en');

  await button.reply({ content: confirmMsg, ephemeral: true }).catch(() => null);
}
