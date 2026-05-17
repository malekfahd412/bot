import { ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { WarEventDB, EventTeamDB } from '../database/db.js';
import { WarEventManager, buildLeaderboardEmbed } from '../systems/war-event.js';
import { logger } from '../utils/logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   BUTTON ROUTER  (customId starts with war_event:)
───────────────────────────────────────────────────────────────────────── */

export async function routeWarEventButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('war_event:')) return false;

  const parts = id.split(':');
  const action = parts[1];
  const eventId = parts[2];

  if (!eventId) return false;

  const user = interaction.user;

  /* ── Join button ── */
  if (action === 'join') {
    try {
      const result = WarEventManager.joinEvent(
        eventId,
        user.id,
        user.displayName,
        user.displayAvatarURL({ extension: 'png', size: 256 }),
      );

      if (result.ok === false) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return true;
      }

      const event = WarEventDB.findById(eventId);
      if (event) {
        void WarEventManager.updateAnnouncementMessage(event, interaction.client);
      }

      await interaction.reply({
        content: `✅ You've joined the **${event?.title ?? 'Crew War'}** as part of **${result.crewName}**! Represent your crew and earn points!`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('War event join error:', err);
      await interaction.reply({ content: '❌ Failed to join event.', ephemeral: true });
    }
    return true;
  }

  /* ── Status / Leaderboard button ── */
  if (action === 'status') {
    try {
      const event = WarEventDB.findById(eventId);
      if (!event) {
        await interaction.reply({ content: '❌ Event not found.', ephemeral: true });
        return true;
      }
      const teams = EventTeamDB.getTeams(eventId);
      const embed = buildLeaderboardEmbed(event, teams);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      logger.error('War event status error:', err);
      await interaction.reply({ content: '❌ Failed to fetch leaderboard.', ephemeral: true });
    }
    return true;
  }

  return false;
}
