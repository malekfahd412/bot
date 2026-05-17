import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ColorResolvable, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { WarEventDB, EventTeamDB, EventParticipantDB } from '../database/db.js';
import type { WarEvent, EventTeam } from '../database/schema.js';
import { logger } from '../utils/logger.js';

type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

const GTA_RED  = 0xFF6B35 as ColorResolvable;
const GTA_GOLD = 0xFFD700 as ColorResolvable;
const GTA_DARK = 0x111122 as ColorResolvable;

/* ─────────────────────────────────────────────────────────────────────────
   EMBED BUILDERS
───────────────────────────────────────────────────────────────────────── */

export function buildControlPanelEmbed(event: WarEvent | undefined, teams: EventTeam[]): EmbedBuilder {
  if (!event) {
    return new EmbedBuilder()
      .setColor(GTA_DARK)
      .setTitle('🚨 EVENT CONTROL CENTER')
      .setDescription(
        '```\n  STATUS: ● OFFLINE — NO ACTIVE EVENT  \n```\n' +
        '> Click **Start Event** to launch a new Crew War operation.\n' +
        '> All event controls live in this panel — no commands needed.'
      )
      .addFields({ name: '⚙️ Admin Actions', value: '`Start Event` — creates event + public announcement\n`Refresh` — syncs panel with latest DB state' })
      .setFooter({ text: '🔒 Admin Panel • Unauthorized interactions are blocked.' })
      .setTimestamp();
  }

  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const totalParticipants = EventParticipantDB.getAll(event.id).length;

  const leaderboard = sorted.slice(0, 5).map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} **[${t.crew_tag}]** ${t.crew_name} — \`${t.score} pts\` (✅${t.heists_success} ❌${t.heists_failed} ⭐${t.bonus_objectives})`;
  }).join('\n') || '*No crews have joined yet.*';

  return new EmbedBuilder()
    .setColor(GTA_RED)
    .setTitle('🚨 EVENT CONTROL CENTER')
    .setDescription(
      `\`\`\`\n  STATUS: ● LIVE — ${event.title.toUpperCase()}  \n\`\`\`\n` +
      `**📊 Live Rankings:**\n${leaderboard}`
    )
    .addFields(
      { name: '👥 Participants', value: `\`${totalParticipants}\``, inline: true },
      { name: '⚔️ Crews',        value: `\`${teams.length}\``,          inline: true },
      { name: '🏆 Rewards',      value: `\`${event.reward_xp} XP\` + \`$${event.reward_coins.toLocaleString()}\``, inline: true },
      { name: '🥇 Current Leader', value: top ? `**[${top.crew_tag}] ${top.crew_name}** — \`${top.score} pts\`` : '*None yet*', inline: false },
    )
    .setFooter({ text: `Event ID: ${event.id.slice(0, 8)} • 🔒 Admin Panel` })
    .setTimestamp();
}

/* ─────────────────────────────────────────────────────────────────────────
   ROW BUILDERS
───────────────────────────────────────────────────────────────────────── */

export function buildControlPanelRows(event: WarEvent | undefined): AnyRow[] {
  if (!event) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('evp:start').setLabel('🟢 Start Event').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('evp:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('evp:leaderboard').setLabel('📊 Leaderboard').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('evp:add_points').setLabel('➕ Add Points').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('evp:manage_crews').setLabel('👥 Manage Crews').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('evp:broadcast').setLabel('📡 Broadcast Update').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('evp:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('evp:end').setLabel('🔴 End Event').setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildConfirmEndRows(): AnyRow[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('evp:end_confirm').setLabel('✅ Confirm — End Event & Distribute Rewards').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('evp:refresh').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function buildAddPointsRows(teams: EventTeam[], panelRef: string): AnyRow[] {
  if (teams.length === 0) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('evp:refresh').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`evp_sel:add_points:${panelRef}`)
        .setPlaceholder('Select a crew to add/deduct points...')
        .addOptions(
          teams.slice(0, 25).map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`[${t.crew_tag}] ${t.crew_name}`)
              .setDescription(`Current score: ${t.score} pts`)
              .setValue(t.crew_id)
          )
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('evp:refresh').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function buildEnterPointsRows(team: EventTeam): AnyRow[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`evp:pts_enter:${team.crew_id}`)
        .setLabel(`✏️ Enter Points — [${team.crew_tag}] ${team.crew_name}`.slice(0, 80))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('evp:add_points')
        .setLabel('← Choose Different Crew')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('evp:refresh')
        .setLabel('✖ Cancel')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildManageCrewsRows(teams: EventTeam[], panelRef: string): AnyRow[] {
  if (teams.length === 0) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('evp:refresh').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`evp_sel:manage_crew:${panelRef}`)
        .setPlaceholder('Select a crew to inspect...')
        .addOptions(
          teams.slice(0, 25).map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`[${t.crew_tag}] ${t.crew_name}`)
              .setDescription(`Score: ${t.score} pts | ✅${t.heists_success} ❌${t.heists_failed} ⭐${t.bonus_objectives}`)
              .setValue(t.crew_id)
          )
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('evp:refresh').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   ANNOUNCEMENT EMBED (public channel)
───────────────────────────────────────────────────────────────────────── */

export function buildAnnouncementEmbed(event: WarEvent, teams: EventTeam[]): EmbedBuilder {
  const leaderboard = [...teams].sort((a, b) => b.score - a.score)
    .map((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **[${t.crew_tag}] ${t.crew_name}** — \`${t.score} pts\``;
    }).join('\n') || '*No crews registered yet. Be the first!*';

  return new EmbedBuilder()
    .setColor(GTA_GOLD)
    .setTitle('🏴 CREW WAR — OPERATION ACTIVE')
    .setDescription(
      `**${event.title}**\n\n` +
      `> 🚨 A city-wide operation is underway. Crews battle for supremacy.\n` +
      `> Join with your crew and earn points through heists and missions.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n**📊 Live Standings:**\n${leaderboard}`
    )
    .addFields(
      { name: '🏆 Prize', value: `\`${event.reward_xp} XP\` + \`$${event.reward_coins.toLocaleString()}\` per winning member`, inline: true },
      { name: '⚔️ Scoring', value: '`+100` success `+150` perfect\n`-50` failure `+75` bonus', inline: true },
    )
    .setFooter({ text: `Operation ${event.id.slice(0, 8)} • Admin-tracked results` })
    .setTimestamp();
}

export function buildAnnouncementRows(eventId: string): AnyRow[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`war_event:join:${eventId}`).setLabel('⚔️ Join Event').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`war_event:leave:${eventId}`).setLabel('👋 Leave').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`war_event:status:${eventId}`).setLabel('📊 Leaderboard').setStyle(ButtonStyle.Primary),
    ),
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   MODALS
───────────────────────────────────────────────────────────────────────── */

export function buildStartEventModal(panelRef: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`evp_mod:start:${panelRef}`)
    .setTitle('🟢 Start New Crew War Event')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ev_title').setLabel('Event Title').setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(60).setPlaceholder('e.g. Operation Big Score')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ev_description').setLabel('Description (optional)').setStyle(TextInputStyle.Paragraph)
          .setRequired(false).setMaxLength(200).setPlaceholder('Brief event briefing shown to players...')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ev_reward_xp').setLabel('XP Reward for winning crew members').setStyle(TextInputStyle.Short)
          .setRequired(false).setMaxLength(6).setPlaceholder('500').setValue('500')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ev_reward_coins').setLabel('Coin Reward for winning crew members').setStyle(TextInputStyle.Short)
          .setRequired(false).setMaxLength(8).setPlaceholder('5000').setValue('5000')
      ),
    );
}

export function buildAddPointsModal(crewId: string, crewName: string, panelRef: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`evp_mod:add_points:${crewId}:${panelRef}`)
    .setTitle(`➕ Score — ${crewName.slice(0, 30)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pts_value').setLabel('Points (use negative to deduct, e.g. -50)').setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(6).setPlaceholder('e.g. 100 or -50')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pts_reason').setLabel('Reason (optional)').setStyle(TextInputStyle.Short)
          .setRequired(false).setMaxLength(80).setPlaceholder('e.g. Heist success on Pacific Standard')
      ),
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   PANEL REFRESH HELPER (for modal callbacks that can't call update())
───────────────────────────────────────────────────────────────────────── */

export async function refreshPanelMessage(
  client: import('discord.js').Client,
  channelId: string,
  messageId: string,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;
    const message = await (channel as TextChannel).messages.fetch(messageId);
    const event = WarEventDB.getActive();
    const teams = event ? EventTeamDB.getTeams(event.id) : [];
    await message.edit({ embeds: [buildControlPanelEmbed(event, teams)], components: buildControlPanelRows(event) });
  } catch (err) {
    logger.warn('Panel refresh failed (stale ref):', err);
  }
}
