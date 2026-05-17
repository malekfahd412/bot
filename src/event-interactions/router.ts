import {
  ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction,
  PermissionFlagsBits, EmbedBuilder, ColorResolvable,
} from 'discord.js';
import { WarEventDB, EventTeamDB, EventParticipantDB, CrewDB } from '../database/db.js';
import { WarEventManager, buildLeaderboardEmbed, buildEventEndEmbed } from '../systems/war-event.js';
import {
  buildControlPanelEmbed, buildControlPanelRows, buildConfirmEndRows,
  buildAddPointsRows, buildManageCrewsRows, buildAnnouncementEmbed, buildAnnouncementRows,
  buildStartEventModal, buildAddPointsModal, refreshPanelMessage,
} from '../event-panels/control-panel.js';
import { logger } from '../utils/logger.js';

const GTA_GOLD = 0xFFD700 as ColorResolvable;
const GTA_RED  = 0xFF6B35 as ColorResolvable;

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function isAdmin(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function panelRef(interaction: ButtonInteraction | StringSelectMenuInteraction): string {
  return `${interaction.channelId}:${interaction.message.id}`;
}

function parsePanelRef(ref: string): { channelId: string; messageId: string } {
  const idx = ref.lastIndexOf(':');
  return { channelId: ref.slice(0, idx), messageId: ref.slice(idx + 1) };
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN PANEL BUTTON ROUTER  (customId starts with evp:)
───────────────────────────────────────────────────────────────────────── */

export async function routeEventPanelButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('evp:')) return false;

  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 This panel is for admins only.', ephemeral: true });
    return true;
  }

  const action = id.slice('evp:'.length);

  /* ── Refresh / Back ── */
  if (action === 'refresh') {
    const event = WarEventDB.getActive();
    const teams = event ? EventTeamDB.getTeams(event.id) : [];
    await interaction.update({
      embeds: [buildControlPanelEmbed(event, teams)],
      components: buildControlPanelRows(event),
    });
    return true;
  }

  /* ── Start Event → open modal ── */
  if (action === 'start') {
    const existing = WarEventDB.getActive();
    if (existing) {
      await interaction.reply({ content: `❌ An event is already active: **${existing.title}**. End it first.`, ephemeral: true });
      return true;
    }
    await interaction.showModal(buildStartEventModal(panelRef(interaction)));
    return true;
  }

  /* ── Live Leaderboard ── */
  if (action === 'leaderboard') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event.', ephemeral: true });
      return true;
    }
    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildLeaderboardEmbed(event, teams);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  /* ── Add Points → show crew select ── */
  if (action === 'add_points') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event.', ephemeral: true });
      return true;
    }
    const teams = EventTeamDB.getTeams(event.id);
    if (teams.length === 0) {
      await interaction.reply({ content: '❌ No crews have joined this event yet.', ephemeral: true });
      return true;
    }
    const ref = panelRef(interaction);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription(embed.data.description + '\n\n> **⬇️ Select a crew below to add/deduct points:**');
    await interaction.update({ embeds: [embed], components: buildAddPointsRows(teams, ref) });
    return true;
  }

  /* ── Manage Crews → show crew select ── */
  if (action === 'manage_crews') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event.', ephemeral: true });
      return true;
    }
    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription(embed.data.description + '\n\n> **⬇️ Select a crew below to inspect their stats:**');
    await interaction.update({ embeds: [embed], components: buildManageCrewsRows(teams, panelRef(interaction)) });
    return true;
  }

  /* ── Broadcast Update ── */
  if (action === 'broadcast') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event to broadcast.', ephemeral: true });
      return true;
    }
    const teams = EventTeamDB.getTeams(event.id);

    const broadcastEmbed = new EmbedBuilder()
      .setColor(GTA_RED)
      .setTitle('📡 LIVE EVENT UPDATE')
      .setDescription(
        `**${event.title}** — Operation Status: 🟢 **ACTIVE**\n\n` +
        [...teams].sort((a, b) => b.score - a.score).slice(0, 5).map((t, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **[${t.crew_tag}]** ${t.crew_name} — \`${t.score} pts\``;
        }).join('\n') || '*No crews registered.*'
      )
      .setFooter({ text: `Broadcast by admin • ${new Date().toLocaleTimeString()}` })
      .setTimestamp();

    if (event.announcement_channel_id) {
      try {
        const ch = await interaction.client.channels.fetch(event.announcement_channel_id);
        if (ch?.isTextBased()) await (ch as import('discord.js').TextChannel).send({ embeds: [broadcastEmbed] });
      } catch {
        await interaction.channel?.send({ embeds: [broadcastEmbed] });
      }
    } else {
      await interaction.channel?.send({ embeds: [broadcastEmbed] });
    }

    await interaction.reply({ content: '📡 Live update broadcast sent.', ephemeral: true });
    return true;
  }

  /* ── End Event → show confirm ── */
  if (action === 'end') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event to end.', ephemeral: true });
      return true;
    }
    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription(
      embed.data.description +
      '\n\n> ⚠️ **Are you sure you want to end this event?**\n' +
      '> This will calculate the winner and distribute all rewards.'
    );
    await interaction.update({ embeds: [embed], components: buildConfirmEndRows() });
    return true;
  }

  /* ── Confirm End Event ── */
  if (action === 'end_confirm') {
    const event = WarEventDB.getActive();
    if (!event) {
      await interaction.reply({ content: '❌ No active event.', ephemeral: true });
      return true;
    }

    const result = WarEventManager.endEvent(event.id, interaction.client);
    if (result.ok === false) {
      await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
      return true;
    }

    const teams = EventTeamDB.getTeams(event.id);
    const finalEmbed = buildEventEndEmbed({ ...event, status: 'ended', ended_at: new Date().toISOString() }, teams);

    if (event.announcement_channel_id) {
      try {
        const ch = await interaction.client.channels.fetch(event.announcement_channel_id);
        if (ch?.isTextBased()) {
          await (ch as import('discord.js').TextChannel).send({ embeds: [finalEmbed] });
        }
      } catch { /* ignore */ }
    }

    const noEvent = WarEventDB.getActive();
    await interaction.update({
      embeds: [buildControlPanelEmbed(noEvent, [])],
      components: buildControlPanelRows(noEvent),
    });
    logger.info(`War event ended via panel: "${event.title}" — winner: ${result.winner?.crew_name ?? 'none'}, rewarded: ${result.rewardedCount}`);
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN PANEL SELECT MENU ROUTER  (customId starts with evp_sel:)
───────────────────────────────────────────────────────────────────────── */

export async function routeEventPanelSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('evp_sel:')) return false;

  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return true;
  }

  /* ── Crew selected for add points → open modal ── */
  if (id.startsWith('evp_sel:add_points:')) {
    const ref = id.slice('evp_sel:add_points:'.length);
    const crewId = interaction.values[0];
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }

    const team = EventTeamDB.findTeam(event.id, crewId);
    if (!team) { await interaction.reply({ content: '❌ Crew not found in event.', ephemeral: true }); return true; }

    await interaction.showModal(buildAddPointsModal(crewId, team.crew_name, ref));
    return true;
  }

  /* ── Crew selected for manage → show stats ── */
  if (id.startsWith('evp_sel:manage_crew:')) {
    const crewId = interaction.values[0];
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }

    const team = EventTeamDB.findTeam(event.id, crewId);
    if (!team) { await interaction.reply({ content: '❌ Crew not found in event.', ephemeral: true }); return true; }

    const participants = EventParticipantDB.getCrewParticipants(event.id, crewId);
    const crew = CrewDB.findById(crewId);

    const embed = new EmbedBuilder()
      .setColor(GTA_GOLD)
      .setTitle(`📋 Crew Stats — [${team.crew_tag}] ${team.crew_name}`)
      .addFields(
        { name: '🏆 Score',           value: `\`${team.score} pts\``,          inline: true },
        { name: '✅ Heist Success',   value: `\`${team.heists_success}\``,      inline: true },
        { name: '❌ Heist Failed',    value: `\`${team.heists_failed}\``,       inline: true },
        { name: '⭐ Bonus Obj.',      value: `\`${team.bonus_objectives}\``,    inline: true },
        { name: '👥 Members in Event',value: `\`${participants.length}\``,      inline: true },
        { name: '📊 Crew Level',      value: `\`${crew?.level ?? '?'}\``,       inline: true },
      )
      .setFooter({ text: 'Crew inspection • Data is live from DB' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN PANEL MODAL ROUTER  (customId starts with evp_mod:)
───────────────────────────────────────────────────────────────────────── */

export async function routeEventPanelModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('evp_mod:')) return false;

  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return true;
  }

  /* ── Start Event modal ── */
  if (id.startsWith('evp_mod:start:')) {
    const ref = id.slice('evp_mod:start:'.length);
    const { channelId, messageId } = parsePanelRef(ref);

    await interaction.deferReply({ ephemeral: true });

    const title      = interaction.fields.getTextInputValue('ev_title').trim();
    const rewardXp   = Math.max(0, parseInt(interaction.fields.getTextInputValue('ev_reward_xp') || '500', 10) || 500);
    const rewardCoins = Math.max(0, parseInt(interaction.fields.getTextInputValue('ev_reward_coins') || '5000', 10) || 5000);

    try {
      const event = WarEventManager.create(title, rewardXp, rewardCoins, interaction.user.id);
      WarEventDB.setAnnouncementMessage(event.id, messageId, channelId);

      const annEmbed = buildAnnouncementEmbed(event, []);
      const annRows  = buildAnnouncementRows(event.id);
      const annMsg   = await interaction.channel?.send({ embeds: [annEmbed], components: annRows });

      if (annMsg) {
        WarEventDB.setAnnouncementMessage(event.id, annMsg.id, annMsg.channelId);
      }

      await interaction.editReply(`✅ **${title}** is now live! Public announcement sent.`);
      void refreshPanelMessage(interaction.client, channelId, messageId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply(`❌ ${msg}`);
    }
    return true;
  }

  /* ── Add Points modal ── */
  if (id.startsWith('evp_mod:add_points:')) {
    const rest = id.slice('evp_mod:add_points:'.length);
    const refIdx = rest.indexOf(':', rest.indexOf(':') + 1);
    const crewId = rest.slice(0, refIdx === -1 ? rest.length : rest.lastIndexOf(':', rest.length - 20 - 1));

    const parts = rest.split(':');
    const messageId  = parts[parts.length - 1];
    const channelId  = parts[parts.length - 2];
    const crewIdParsed = parts.slice(0, parts.length - 2).join(':');

    await interaction.deferReply({ ephemeral: true });

    const event = WarEventDB.getActive();
    if (!event) { await interaction.editReply('❌ No active event.'); return true; }

    const ptsStr = interaction.fields.getTextInputValue('pts_value').trim().replace(/\s+/g, '');
    const reason = interaction.fields.getTextInputValue('pts_reason').trim() || undefined;
    const pts = parseInt(ptsStr, 10);

    if (isNaN(pts)) {
      await interaction.editReply('❌ Invalid points value. Use a number like `100` or `-50`.');
      return true;
    }

    const team = EventTeamDB.findTeam(event.id, crewIdParsed);
    if (!team) { await interaction.editReply('❌ Crew not found in event.'); return true; }

    const field = pts < 0 ? 'heists_failed' : pts >= 150 ? 'heists_success' : 'heists_success';
    EventTeamDB.addScore(event.id, crewIdParsed, pts, field as 'heists_success' | 'heists_failed' | 'bonus_objectives');
    const updated = EventTeamDB.findTeam(event.id, crewIdParsed)!;

    const sign = pts > 0 ? '+' : '';
    await interaction.editReply(
      `${pts >= 0 ? '✅' : '❌'} **${sign}${pts} pts** added to **[${team.crew_tag}] ${team.crew_name}**.\n` +
      `New score: \`${updated.score} pts\`` +
      (reason ? `\nNote: *${reason}*` : '')
    );

    void refreshPanelMessage(interaction.client, channelId, messageId);
    void WarEventManager.updateAnnouncementMessage(event, interaction.client);
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   PLAYER ANNOUNCEMENT BUTTON ROUTER  (customId starts with war_event:)
───────────────────────────────────────────────────────────────────────── */

export async function routeWarEventButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('war_event:')) return false;

  const parts  = id.split(':');
  const action  = parts[1];
  const eventId = parts[2];

  if (!eventId) return false;

  const user = interaction.user;

  /* ── Join ── */
  if (action === 'join') {
    try {
      const result = WarEventManager.joinEvent(
        eventId, user.id, user.displayName,
        user.displayAvatarURL({ extension: 'png', size: 256 }),
      );

      if (result.ok === false) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return true;
      }

      const event = WarEventDB.findById(eventId);
      if (event) void WarEventManager.updateAnnouncementMessage(event, interaction.client);

      await interaction.reply({
        content: `✅ You've joined **${event?.title ?? 'Crew War'}** representing **${result.crewName}**! Good luck out there.`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('War event join error:', err);
      await interaction.reply({ content: '❌ Failed to join event.', ephemeral: true });
    }
    return true;
  }

  /* ── Leave ── */
  if (action === 'leave') {
    try {
      const event = WarEventDB.findById(eventId);
      if (!event || event.status !== 'active') {
        await interaction.reply({ content: '❌ This event is no longer active.', ephemeral: true });
        return true;
      }
      const result = WarEventManager.leaveEvent(eventId, user.id);
      if (result.ok === false) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return true;
      }
      await interaction.reply({ content: '👋 You have left the event.', ephemeral: true });
    } catch (err) {
      logger.error('War event leave error:', err);
      await interaction.reply({ content: '❌ Failed to leave event.', ephemeral: true });
    }
    return true;
  }

  /* ── Status / Leaderboard ── */
  if (action === 'status') {
    try {
      const event = WarEventDB.findById(eventId);
      if (!event) { await interaction.reply({ content: '❌ Event not found.', ephemeral: true }); return true; }
      const teams = EventTeamDB.getTeams(eventId);
      await interaction.reply({ embeds: [buildLeaderboardEmbed(event, teams)], ephemeral: true });
    } catch (err) {
      logger.error('War event status error:', err);
      await interaction.reply({ content: '❌ Failed to fetch leaderboard.', ephemeral: true });
    }
    return true;
  }

  return false;
}
