import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { CrewDB } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('crew')
  .setDescription('Crew system')
  .addSubcommand(sub =>
    sub.setName('dashboard')
      .setDescription('Open crew dashboard')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const crews = CrewDB.getAllCrews();

  const embed = new EmbedBuilder()
    .setTitle('🏴 Crew Dashboard')
    .setDescription(
      crews.length
        ? 'Select a crew from the list below:'
        : 'No crews available yet.'
    )
    .setColor('Gold');

  const select = new StringSelectMenuBuilder()
    .setCustomId('crew_select')
    .setPlaceholder('Select a crew...')
    .addOptions(
      crews.slice(0, 25).map(c => ({
        label: c.name,
        description: `Tag: ${c.tag} | Members: ${c.member_count}`,
        value: c.id,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(select);

  await interaction.reply({
    embeds: [embed],
    components: crews.length ? [row] : [],
    ephemeral: true,
  });
}
