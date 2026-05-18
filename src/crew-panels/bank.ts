import { ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB, CrewTransactionDB } from '../database/db.js';
import { buildBankEmbed } from '../crew-ui/embeds.js';
import { buildBankRows } from '../crew-ui/buttons.js';

export async function showBankPanel(interaction: ButtonInteraction): Promise<void> {
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
  const transactions = CrewTransactionDB.getRecent(crew.id, 8);
  const isOwner = player.crew_role === 'owner';

  await interaction.update({
    embeds: [buildBankEmbed(crew, transactions, lang)],
    components: buildBankRows(isOwner, lang),
  });
}
