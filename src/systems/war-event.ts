import { ButtonInteraction, EmbedBuilder, ColorResolvable, TextChannel } from 'discord.js';
import { WarEventDB, EventTeamDB, EventParticipantDB, EventLogDB, PlayerDB, CrewDB } from '../database/db.js';
import { PlayerSystem } from './player.js';
import { logger } from '../utils/logger.js';
import type { WarEvent, EventTeam } from '../database/schema.js';

/* ─────────────────────────────────────────────────────────────────────────
   SCORING CONFIG
───────────────────────────────────────────────────────────────────────── */

export const SCORE_ACTIONS = {
  success: { label: 'Heist Success',    delta: 100,  field: 'heists_success'  as const, emoji: '✅' },
  perfect: { label: 'Perfect Heist',    delta: 150,  field: 'heists_success'  as const, emoji: '💎' },
  fail:    { label: 'Heist Failed',     delta: -50,  field: 'heists_failed'   as const, emoji: '❌' },
  bonus:   { label: 'Bonus Objective',  delta: 75,   field: 'bonus_objectives'as const, emoji: '⭐' },
} as const;

export type ScoreAction = keyof typeof SCORE_ACTIONS;

/* ─────────────────────────────────────────────────────────────────────────
   EMBED BUILDERS
───────────────────────────────────────────────────────────────────────── */

const GTA_RED   = 0xFF6B35 as ColorResolvable;
const GTA_GOLD  = 0xFFD700 as ColorResolvable;
const GTA_GREEN = 0x00FF7F as ColorResolvable;
const GTA_DARK  = 0x1A1A2E as ColorResolvable;

export function buildEventAnnouncementEmbed(event: WarEvent, teams: EventTeam[]): EmbedBuilder {
  const leaderboard = teams
    .sort((a, b) => b.score - a.score)
    .map((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      return `${medal} **[${t.crew_tag}] ${t.crew_name}** — \`${t.score} pts\``;
    })
    .join('\n') || '*No crews registered yet.*';

  return new EmbedBuilder()
    .setColor(GTA_RED)
    .setTitle('🏴 CREW WAR EVENT — ACTIVE')
    .setDescription(
      `**${event.title}**\n\n` +
      `> A city-wide operation is underway. Crews compete for supremacy.\n` +
      `> Join with your crew and climb the ranks.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**📊 LIVE LEADERBOARD**\n` +
      leaderboard
    )
    .addFields(
      { name: '🏆 Rewards (Winners)', value: `\`${event.reward_xp.toLocaleString()} XP\` + \`$${event.reward_coins.toLocaleString()}\` per member`, inline: true },
      { name: '📡 Status', value: '🟢 Active — Points live', inline: true },
      { name: '⚔️ Scoring', value: '`Success +100` `Perfect +150`\n`Failure -50` `Bonus +75`', inline: false },
    )
    .setFooter({ text: `Event ID: ${event.id.slice(0, 8)} • Admin tracked` })
    .setTimestamp();
}

export function buildLeaderboardEmbed(event: WarEvent, teams: EventTeam[]): EmbedBuilder {
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  const rows = sorted.map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const stats = `✅${t.heists_success} ❌${t.heists_failed} ⭐${t.bonus_objectives}`;
    return `${medal} **[${t.crew_tag}] ${t.crew_name}**\n   \`${t.score} pts\` • ${stats}`;
  }).join('\n\n') || '*No crews competing yet.*';

  return new EmbedBuilder()
    .setColor(GTA_GOLD)
    .setTitle(`📊 ${event.title} — Leaderboard`)
    .setDescription(rows)
    .setFooter({ text: 'Updates every time a score is logged.' })
    .setTimestamp();
}

export function buildEventEndEmbed(event: WarEvent, teams: EventTeam[]): EmbedBuilder {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const ranking = sorted.map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} **[${t.crew_tag}] ${t.crew_name}** — \`${t.score} pts\` (✅${t.heists_success} ❌${t.heists_failed} ⭐${t.bonus_objectives})`;
  }).join('\n') || '*No teams competed.*';

  return new EmbedBuilder()
    .setColor(GTA_GOLD)
    .setTitle('🏆 CREW WAR EVENT — CONCLUDED')
    .setDescription(
      winner
        ? `**WINNER: [${winner.crew_tag}] ${winner.crew_name}** with \`${winner.score} points\`!\n\n` +
          `All winning crew members have received their rewards.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n**Final Rankings:**\n${ranking}`
        : `Event ended with no participants.\n\n${ranking}`
    )
    .addFields(
      { name: '🎁 Rewards Distributed', value: winner ? `\`${event.reward_xp} XP\` + \`$${event.reward_coins}\` to all **${winner.crew_name}** members` : 'No rewards — no participants.' },
    )
    .setTimestamp();
}

/* ─────────────────────────────────────────────────────────────────────────
   WAR EVENT MANAGER
───────────────────────────────────────────────────────────────────────── */

export class WarEventManager {

  /* ── Create ── */
  static create(title: string, rewardXp: number, rewardCoins: number, createdBy: string): WarEvent {
    const existing = WarEventDB.getActive();
    if (existing) throw new Error('An event is already active. End it first.');
    return WarEventDB.create(title, rewardXp, rewardCoins, createdBy);
  }

  /* ── Join ── */
  static joinEvent(
    eventId: string,
    userId: string,
    displayName: string,
    avatarUrl: string,
  ): { ok: true; crewName: string } | { ok: false; reason: string } {
    const event = WarEventDB.findById(eventId);
    if (!event || event.status !== 'active') return { ok: false, reason: 'This event is no longer active.' };

    if (EventParticipantDB.isParticipant(eventId, userId)) {
      return { ok: false, reason: 'You have already joined this event.' };
    }

    const player = PlayerSystem.getOrCreate(userId, displayName, avatarUrl);
    if (!player.crew_id) return { ok: false, reason: 'You must be in a crew to join this event. Use `/crew` to create or join one.' };

    const crew = CrewDB.findById(player.crew_id);
    if (!crew) return { ok: false, reason: 'Your crew could not be found. Please rejoin your crew.' };

    let team = EventTeamDB.findTeam(eventId, crew.id);
    if (!team) {
      team = EventTeamDB.addTeam(eventId, crew.id, crew.name, crew.tag);
    }

    EventParticipantDB.join(eventId, userId, crew.id);
    EventLogDB.log(eventId, `<@${userId}> joined as **[${crew.tag}] ${crew.name}**`, crew.id, 0);

    return { ok: true, crewName: crew.name };
  }

  /* ── Leave ── */
  static leaveEvent(eventId: string, userId: string): { ok: true } | { ok: false; reason: string } {
    const event = WarEventDB.findById(eventId);
    if (!event || event.status !== 'active') return { ok: false, reason: 'No active event to leave.' };
    if (!EventParticipantDB.isParticipant(eventId, userId)) return { ok: false, reason: 'You are not in this event.' };
    EventParticipantDB.leave(eventId, userId);
    return { ok: true };
  }

  /* ── Score ── */
  static logScore(
    eventId: string,
    crewId: string,
    action: ScoreAction,
    note?: string,
  ): { ok: true; team: EventTeam; delta: number } | { ok: false; reason: string } {
    const event = WarEventDB.findById(eventId);
    if (!event || event.status !== 'active') return { ok: false, reason: 'No active event.' };

    const team = EventTeamDB.findTeam(eventId, crewId);
    if (!team) return { ok: false, reason: 'This crew is not registered in the event.' };

    const cfg = SCORE_ACTIONS[action];
    EventTeamDB.addScore(eventId, crewId, cfg.delta, cfg.field);
    const msg = `${cfg.emoji} **[${team.crew_tag}] ${team.crew_name}** — ${cfg.label} (${cfg.delta > 0 ? '+' : ''}${cfg.delta} pts)${note ? ` — *${note}*` : ''}`;
    EventLogDB.log(eventId, msg, crewId, cfg.delta);

    const updated = EventTeamDB.findTeam(eventId, crewId)!;
    return { ok: true, team: updated, delta: cfg.delta };
  }

  /* ── End ── */
  static endEvent(eventId: string, client: import('discord.js').Client): {
    ok: true; winner: EventTeam | null; rewardedCount: number
  } | { ok: false; reason: string } {
    const event = WarEventDB.findById(eventId);
    if (!event || event.status !== 'active') return { ok: false, reason: 'No active event to end.' };

    const teams = EventTeamDB.getTeams(eventId);
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const winner = sorted[0] ?? null;

    let rewardedCount = 0;

    if (winner && winner.score > 0) {
      const members = CrewDB.getMembers(winner.crew_id);
      for (const member of members) {
        PlayerDB.addXP(member.discord_id, event.reward_xp);
        PlayerDB.addCoins(member.discord_id, event.reward_coins);
        rewardedCount++;
      }
      WarEventDB.end(eventId, winner.crew_id);
      EventLogDB.log(eventId, `🏆 Event ended. Winner: **[${winner.crew_tag}] ${winner.crew_name}** — ${rewardedCount} members rewarded.`, winner.crew_id, 0);
    } else {
      WarEventDB.end(eventId, null);
      EventLogDB.log(eventId, '🏁 Event ended with no winner.', null, 0);
    }

    void this.updateAnnouncementMessage(event, client, true);

    return { ok: true, winner, rewardedCount };
  }

  /* ── Update live announcement embed ── */
  static async updateAnnouncementMessage(event: WarEvent, client: import('discord.js').Client, ended = false): Promise<void> {
    if (!event.announcement_message_id || !event.announcement_channel_id) return;
    try {
      const channel = await client.channels.fetch(event.announcement_channel_id);
      if (!channel || !channel.isTextBased()) return;
      const textChannel = channel as TextChannel;
      const message = await textChannel.messages.fetch(event.announcement_message_id);
      if (!message) return;

      const teams = EventTeamDB.getTeams(event.id);

      if (ended) {
        const finalEvent = WarEventDB.findById(event.id)!;
        const embed = buildEventEndEmbed(finalEvent, teams);
        await message.edit({ embeds: [embed], components: [] });
      } else {
        const embed = buildEventAnnouncementEmbed(event, teams);
        await message.edit({ embeds: [embed] });
      }
    } catch (err) {
      logger.warn('Failed to update event announcement:', err);
    }
  }
}
