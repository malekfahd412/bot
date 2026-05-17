import { ButtonInteraction } from 'discord.js';
import { CrewSystem } from '../systems/crew.js';

export async function handleCrewJoin(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith('crew_join:')) return;

  const crewId = interaction.customId.split(':')[1];

  try {
    CrewSystem.join(crewId, interaction.user.id);

    await interaction.reply({
      content: `✅ You joined the crew successfully!`,
      ephemeral: true,
    });

  } catch (err: any) {
    await interaction.reply({
      content: `❌ ${err.message}`,
      ephemeral: true,
    });
  }
}
