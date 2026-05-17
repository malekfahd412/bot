import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { WarEventDB, EventTeamDB } from '../database/db.js';
import { buildControlPanelEmbed, buildControlPanelRows } from '../event-panels/control-panel.js';

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('🚨 Open the Event Control Panel (Admin only)');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🚫 This panel is for admins only.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const event = WarEventDB.getActive();
  const teams = event ? EventTeamDB.getTeams(event.id) : [];
  const embed = buildControlPanelEmbed(event, teams);
  const rows = buildControlPanelRows(event);

  await interaction.editReply({ embeds: [embed], components: rows });
}
