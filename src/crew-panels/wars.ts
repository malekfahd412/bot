import { ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB, CrewWarDB } from '../database/db.js';
import { buildWarsEmbed } from '../crew-ui/embeds.js';
import { buildWarsRows } from '../crew-ui/buttons.js';

export async function showWarsPanel(interaction: ButtonInteraction): Promise<void> {
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

  const active = CrewWarDB.getActiveForCrew(crew.id);
  const history = CrewWarDB.getHistoryForCrew(crew.id, 5);
  const allCrews = CrewDB.getAllCrews();

  await interaction.update({
    embeds: [buildWarsEmbed(crew, active, history)],
    components: buildWarsRows(allCrews, crew.id, active),
  });
}
