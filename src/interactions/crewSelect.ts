import {
  StringSelectMenuInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { CrewDB, PlayerDB } from '../database/db.js';
import { generateCrewCard } from '../canvas/stats-card.js';
import { logger } from '../utils/logger.js';

export async function handleCrewSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId !== 'crew_select') return;

  await interaction.deferUpdate();

  const crewId = interaction.values[0];
  const crew = CrewDB.findById(crewId);

  if (!crew) {
    await interaction.followUp({ content: '❌ Crew not found.', ephemeral: true });
    return;
  }

  const members = CrewDB.getMembers(crewId);
  const owner = PlayerDB.findByDiscordId(crew.owner_id);

  if (!owner) {
    await interaction.followUp({ content: '❌ Crew data unavailable.', ephemeral: true });
    return;
  }

  try {
    const buffer = await generateCrewCard(crew, members, owner);

    const joinBtn = new ButtonBuilder()
      .setCustomId(`crew_join:${crew.id}`)
      .setLabel('Join Crew')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn);

    await interaction.editReply({
      files: [new AttachmentBuilder(buffer, { name: 'crew.png' })],
      components: [row],
      embeds: [],
    });
  } catch (err) {
    logger.error('Crew card generation failed in select handler:', err);
    await interaction.followUp({ content: '❌ Failed to load crew card.', ephemeral: true });
  }
}
