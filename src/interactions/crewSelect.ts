import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { CrewDB } from '../database/db.js';
import { CrewSystem } from '../systems/crew.js';

export async function handleCrewSelect(interaction: StringSelectMenuInteraction) {
  if (interaction.customId !== 'crew_select') return;

  const crewId = interaction.values[0];
  const crew = CrewDB.findById(crewId);

  if (!crew) {
    return interaction.reply({
      content: '❌ Crew not found',
      ephemeral: true,
    });
  }

  const members = CrewDB.getMembers(crewId);

  const embed = new EmbedBuilder()
    .setTitle(`🏴 ${crew.name}`)
    .setDescription(crew.description || 'No description')
    .addFields(
      { name: 'Tag', value: crew.tag, inline: true },
      { name: 'Members', value: String(members.length), inline: true },
      { name: 'Earnings', value: String(crew.total_earnings), inline: true },
    )
    .setColor('Gold');

  const joinBtn = new ButtonBuilder()
    .setCustomId(`crew_join_${crew.id}`)
    .setLabel('Join Crew')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(joinBtn);

  await interaction.update({
    embeds: [embed],
    components: [row],
  });
}
