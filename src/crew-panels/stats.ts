import { ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB } from '../database/db.js';
import { buildStatsEmbed } from '../crew-ui/embeds.js';
import { buildStatsRows } from '../crew-ui/buttons.js';

export async function showStatsPanel(interaction: ButtonInteraction): Promise<void> {
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

  const lang = player.language ?? 'en';
  const members = CrewDB.getMembers(crew.id);
  const allCrews = CrewDB.getLeaderboard(100);
  const globalRank = allCrews.findIndex(c => c.id === crew.id) + 1 || allCrews.length + 1;

  await interaction.update({
    embeds: [buildStatsEmbed(crew, members, globalRank, lang)],
    components: buildStatsRows(lang),
  });
}
