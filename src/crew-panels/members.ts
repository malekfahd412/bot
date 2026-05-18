import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PlayerDB, CrewDB } from '../database/db.js';
import { buildMembersEmbed } from '../crew-ui/embeds.js';
import { buildMembersRows, buildMemberActionRows } from '../crew-ui/buttons.js';

const PAGE_SIZE = 5;

export async function showMembersPanel(interaction: ButtonInteraction, page: number): Promise<void> {
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
  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const isOwner = player.crew_role === 'owner';

  await interaction.update({
    embeds: [buildMembersEmbed(crew, members, safePage, totalPages, lang)],
    components: buildMembersRows(safePage, totalPages, isOwner, members, lang),
  });
}

/* ─── SHOW MEMBER ACTION PANEL ─── */

export async function showMemberActions(interaction: any, targetDiscordId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({
      content: '❌ Only the crew owner can manage members.',
      embeds: [],
      components: [],
    });
    return;
  }

  const target = PlayerDB.findByDiscordId(targetDiscordId);
  if (!target || target.crew_id !== player.crew_id) {
    await interaction.update({ content: '❌ Member not found in your crew.', embeds: [], components: [] });
    return;
  }

  const lang = player.language ?? 'en';
  const isOfficer = target.crew_role === 'officer';

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(`⚙️ Managing: ${target.display_name}`)
    .setDescription(
      `> **Role:** ${target.crew_role}\n` +
      `> **Level:** ${target.level}\n` +
      `> **Total Earnings:** $${target.total_earnings.toLocaleString()}\n\n` +
      `Select an action below:`
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: buildMemberActionRows(targetDiscordId, isOfficer, lang),
  });
}
