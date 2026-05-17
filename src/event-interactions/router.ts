import {
  ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction,
  PermissionFlagsBits, EmbedBuilder, ColorResolvable,
} from 'discord.js';
import { buildHistoryEmbed, buildHistoryRows } from '../commands/event.js';
import { WarEventDB, EventTeamDB, EventParticipantDB, EventLogDB, CrewDB } from '../database/db.js';
import { WarEventManager, buildLeaderboardEmbed, buildEventEndEmbed } from '../systems/war-event.js';
import {
  buildControlPanelEmbed, buildControlPanelRows, buildConfirmEndRows,
  buildAddPointsRows, buildManageCrewsRows, buildEnterPointsRows,
  buildAnnouncementEmbed, buildAnnouncementRows,
  buildStartEventModal, buildAddPointsModal, refreshPanelMessage,
} from '../event-panels/control-panel.js';
import { logger } from '../utils/logger.js';

const GTA_GOLD = 0xFFD700 as ColorResolvable;

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

  /* ── Live Leaderboard (ephemeral) ── */
  if (action === 'leaderboard') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }
    const teams = EventTeamDB.getTeams(event.id);
    await interaction.reply({ embeds: [buildLeaderboardEmbed(event, teams)], ephemeral: true });
    return true;
  }

  /* ── Add Points → show crew select ── */
  if (action === 'add_points') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }
    const teams = EventTeamDB.getTeams(event.id);
    if (teams.length === 0) { await interaction.reply({ content: '❌ No crews have joined yet.', ephemeral: true }); return true; }

    const ref = panelRef(interaction);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription((embed.data.description ?? '') + '\n\n> **⬇️ Select a crew to add or deduct points:**');
    await interaction.update({ embeds: [embed], components: buildAddPointsRows(teams, ref) });
    return true;
  }

  /* ── Points Enter (crew selected via select → this button → modal) ── */
  if (action.startsWith('pts_enter:')) {
    const crewId = action.slice('pts_enter:'.length);
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }
    const team = EventTeamDB.findTeam(event.id, crewId);
    if (!team) { await interaction.reply({ content: '❌ Crew not found in event.', ephemeral: true }); return true; }
    await interaction.showModal(buildAddPointsModal(crewId, team.crew_name, panelRef(interaction)));
    return true;
  }

  /* ── Manage Crews → show crew select ── */
  if (action === 'manage_crews') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }
    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription((embed.data.description ?? '') + '\n\n> **⬇️ Select a crew to inspect their stats:**');
    await interaction.update({ embeds: [embed], components: buildManageCrewsRows(teams, panelRef(interaction)) });
    return true;
  }

  /* ── Broadcast live update to announcement channel ── */
  if (action === 'broadcast') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event to broadcast.', ephemeral: true }); return true; }
    const teams = EventTeamDB.getTeams(event.id);

    const broadcastEmbed = new EmbedBuilder()
      .setColor(0xFF6B35 as ColorResolvable)
      .setTitle('📡 LIVE EVENT UPDATE')
      .setDescription(
        `**${event.title}** — Status: 🟢 **ACTIVE**\n\n` +
        [...teams].sort((a, b) => b.score - a.score).slice(0, 5).map((t, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **[${t.crew_tag}]** ${t.crew_name} — \`${t.score} pts\``;
        }).join('\n') || '*No crews registered.*'
      )
      .setFooter({ text: `Broadcast by admin • ${new Date().toLocaleTimeString()}` })
      .setTimestamp();

    let sent = false;
    if (event.announcement_channel_id) {
      try {
        const ch = await interaction.client.channels.fetch(event.announcement_channel_id);
        if (ch?.isTextBased()) {
          await (ch as import('discord.js').TextChannel).send({ embeds: [broadcastEmbed] });
          sent = true;
        }
      } catch { /* fall through */ }
    }
    if (!sent) {
      await interaction.channel?.send({ embeds: [broadcastEmbed] });
    }

    await interaction.reply({ content: '📡 Live update broadcast sent.', ephemeral: true });
    return true;
  }

  /* ── End Event → show confirm ── */
  if (action === 'end') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event to end.', ephemeral: true }); return true; }
    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription(
      (embed.data.description ?? '') +
      '\n\n> ⚠️ **Are you sure you want to end this event?**\n' +
      '> This will calculate the winner and distribute all rewards.'
    );
    await interaction.update({ embeds: [embed], components: buildConfirmEndRows() });
    return true;
  }

  /* ── Confirm End Event ── */
  if (action === 'end_confirm') {
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }

    const result = WarEventManager.endEvent(event.id, interaction.client);
    if (result.ok === false) {
      await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
      return true;
    }

    logger.info(`War event ended via panel: "${event.title}" — winner: ${result.winner?.crew_name ?? 'none'}, rewarded: ${result.rewardedCount}`);

    // endEvent() already edits the announcement message to the final embed — no duplicate send needed.
    const noEvent = WarEventDB.getActive();
    await interaction.update({
      embeds: [buildControlPanelEmbed(noEvent, [])],
      components: buildControlPanelRows(noEvent),
    });
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

  /* ── Crew selected for add points → update panel to show "Enter Points" button ──
     NOTE: Discord does NOT allow showing a modal from a select menu interaction.
     We update the panel to show a dedicated button the admin clicks to open the modal. */
  if (id.startsWith('evp_sel:add_points:')) {
    const crewId = interaction.values[0];
    const event = WarEventDB.getActive();
    if (!event) { await interaction.reply({ content: '❌ No active event.', ephemeral: true }); return true; }

    const team = EventTeamDB.findTeam(event.id, crewId);
    if (!team) { await interaction.reply({ content: '❌ Crew not found in event.', ephemeral: true }); return true; }

    const teams = EventTeamDB.getTeams(event.id);
    const embed = buildControlPanelEmbed(event, teams);
    embed.setDescription(
      (embed.data.description ?? '') +
      `\n\n> 🎯 Selected: **[${team.crew_tag}] ${team.crew_name}** — current score: \`${team.score} pts\`\n` +
      `> Click the button below to enter a point adjustment.`
    );
    await interaction.update({ embeds: [embed], components: buildEnterPointsRows(team) });
    return true;
  }

  /* ── Crew selected for manage → show stats (ephemeral reply) ── */
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
        { name: '🏆 Score',            value: `\`${team.score} pts\``,       inline: true },
        { name: '✅ Heist Success',    value: `\`${team.heists_success}\``,   inline: true },
        { name: '❌ Heist Failed',     value: `\`${team.heists_failed}\``,    inline: true },
        { name: '⭐ Bonus Obj.',       value: `\`${team.bonus_objectives}\``, inline: true },
        { name: '👥 Members in Event', value: `\`${participants.length}\``,   inline: true },
        { name: '📊 Crew Level',       value: `\`${crew?.level ?? '?'}\``,    inline: true },
      )
      .setFooter({ text: 'Live data from DB • Click ← Back on the panel to return' });

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

    const title       = interaction.fields.getTextInputValue('ev_title').trim();
    const rewardXp    = Math.max(0, parseInt(interaction.fields.getTextInputValue('ev_reward_xp')    || '500',  10) || 500);
    const rewardCoins = Math.max(0, parseInt(interaction.fields.getTextInputValue('ev_reward_coins') || '5000', 10) || 5000);

    try {
      const event = WarEventManager.create(title, rewardXp, rewardCoins, interaction.user.id);

      const annEmbed = buildAnnouncementEmbed(event, []);
      const annRows  = buildAnnouncementRows(event.id);
      const annMsg   = await interaction.channel?.send({ embeds: [annEmbed], components: annRows });

      if (annMsg) {
        WarEventDB.setAnnouncementMessage(event.id, annMsg.id, annMsg.channelId);
      }

      await interaction.editReply(`✅ **${title}** is now live! Public announcement sent in this channel.`);
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

    // Format: <crewId (UUID, no colons)>:<channelId>:<messageId>
    const parts      = rest.split(':');
    const messageId  = parts[parts.length - 1];
    const channelId  = parts[parts.length - 2];
    const crewId     = parts.slice(0, parts.length - 2).join(':');

    await interaction.deferReply({ ephemeral: true });

    const event = WarEventDB.getActive();
    if (!event) { await interaction.editReply('❌ No active event.'); return true; }

    const team = EventTeamDB.findTeam(event.id, crewId);
    if (!team) { await interaction.editReply('❌ Crew not found in this event.'); return true; }

    const ptsStr = interaction.fields.getTextInputValue('pts_value').trim().replace(/\s+/g, '');
    const reason = interaction.fields.getTextInputValue('pts_reason').trim() || undefined;
    const pts    = parseInt(ptsStr, 10);

    if (isNaN(pts) || pts === 0) {
      await interaction.editReply('❌ Enter a non-zero number like `100` or `-50`.');
      return true;
    }

    // Use raw score update — this is an admin manual adjustment, not a heist action.
    // heists_success / heists_failed / bonus_objectives counts are only bumped via logScore().
    EventTeamDB.addRawScore(event.id, crewId, pts);
    const updated = EventTeamDB.findTeam(event.id, crewId)!;

    const sign = pts > 0 ? '+' : '';
    const reasonNote = reason ? ` — *${reason}*` : '';
    const logMsg = `🔧 Admin <@${interaction.user.id}> adjusted **[${team.crew_tag}] ${team.crew_name}**: \`${sign}${pts} pts\`${reasonNote}`;
    EventLogDB.log(event.id, logMsg, crewId, pts);

    await interaction.editReply(
      `${pts > 0 ? '✅' : '🔻'} **${sign}${pts} pts** applied to **[${team.crew_tag}] ${team.crew_name}**.\n` +
      `New score: \`${updated.score} pts\`` + (reason ? `\n> 📝 *${reason}*` : '')
    );

    void refreshPanelMessage(interaction.client, channelId, messageId);
    void WarEventManager.updateAnnouncementMessage(
      WarEventDB.findById(event.id) ?? event,
      interaction.client
    );
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   HISTORY PAGINATION BUTTON ROUTER  (customId starts with ehist:)
───────────────────────────────────────────────────────────────────────── */

export async function routeEventHistoryButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('ehist:')) return false;

  if (id === 'ehist:label') {
    await interaction.deferUpdate();
    return true;
  }

  if (id.startsWith('ehist:page:')) {
    const page = parseInt(id.slice('ehist:page:'.length), 10);
    if (isNaN(page) || page < 0) { await interaction.deferUpdate(); return true; }

    const total = WarEventDB.countEnded();
    if (page >= total) { await interaction.deferUpdate(); return true; }

    const [event] = WarEventDB.getHistoryPaged(1, page);
    if (!event) { await interaction.deferUpdate(); return true; }

    const teams = EventTeamDB.getTeams(event.id);
    await interaction.update({
      embeds: [buildHistoryEmbed(event, teams, page, total)],
      components: buildHistoryRows(page, total),
    });
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

  const parts   = id.split(':');
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
        content: `✅ You've joined **${event?.title ?? 'the event'}** representing **${result.crewName}**! Good luck out there.`,
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
