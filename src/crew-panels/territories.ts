import { ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB, TerritoryDB } from '../database/db.js';
import { buildTerritoriesEmbed } from '../crew-ui/embeds.js';
import { buildTerritoriesRows } from '../crew-ui/buttons.js';

export async function showTerritoriesPanel(interaction: ButtonInteraction): Promise<void> {
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

  const allTerritories = TerritoryDB.getAll();

  await interaction.update({
    embeds: [buildTerritoriesEmbed(crew, allTerritories)],
    components: buildTerritoriesRows(allTerritories, crew.id),
  });
}
