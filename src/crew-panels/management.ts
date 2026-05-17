import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PlayerDB, CrewDB } from '../database/db.js';
import { buildManagementEmbed } from '../crew-ui/embeds.js';
import { buildManagementRows, buildConfirmCancelRows } from '../crew-ui/buttons.js';

export async function showManagementPanel(interaction: ButtonInteraction): Promise<void> {
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

  const isOwner = player.crew_role === 'owner';

  await interaction.update({
    embeds: [buildManagementEmbed(crew, isOwner)],
    components: buildManagementRows(isOwner),
  });
}

/* ─── DISBAND CONFIRMATION ─── */

export async function showDisbandConfirm(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can disband the crew.', embeds: [], components: [] });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    await interaction.update({ content: '❌ Crew not found.', embeds: [], components: [] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xE94560)
    .setTitle('⚠️ DISBAND CREW — FINAL WARNING')
    .setDescription(
      `You are about to **permanently disband** **[${crew.tag}] ${crew.name}**.\n\n` +
      `> This will remove all **${crew.member_count}** members from the crew.\n` +
      `> All territory control will be **lost**.\n` +
      `> The crew bank balance of **$${crew.bank_balance.toLocaleString()}** will be **forfeited**.\n\n` +
      `**This action cannot be undone.**`
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: buildConfirmCancelRows('crew:mgmt_disband_confirm', '💥 Disband Forever'),
  });
}

/* ─── LEAVE CONFIRMATION ─── */

export async function showLeaveConfirm(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  if (player.crew_role === 'owner') {
    await interaction.update({
      content: '❌ You are the crew owner. Transfer ownership or disband the crew first.',
      embeds: [],
      components: [],
    });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);

  const embed = new EmbedBuilder()
    .setColor(0xFFA502)
    .setTitle('🚪 LEAVE CREW — CONFIRMATION')
    .setDescription(`Are you sure you want to leave **[${crew?.tag ?? '?'}] ${crew?.name ?? 'your crew'}**?`)
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: buildConfirmCancelRows('crew:leave_confirm', '🚪 Leave Crew'),
  });
}
