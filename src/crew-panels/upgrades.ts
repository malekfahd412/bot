import { ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB } from '../database/db.js';
import { buildUpgradesEmbed } from '../crew-ui/embeds.js';
import { buildUpgradesRows } from '../crew-ui/buttons.js';

export async function showUpgradesPanel(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    await interaction.update({ content: '❌ Crew not found.', embeds: [], components: [] });
    return;
  }

  await interaction.update({
    embeds: [buildUpgradesEmbed(crew)],
    components: buildUpgradesRows(crew),
  });
}
