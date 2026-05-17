import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable,
} from 'discord.js';
import { WarEventDB, EventTeamDB, EventParticipantDB } from '../database/db.js';
import { buildControlPanelEmbed, buildControlPanelRows } from '../event-panels/control-panel.js';
import type { WarEvent, EventTeam } from '../database/schema.js';

const GTA_GOLD = 0xFFD700 as ColorResolvable;
const GTA_DARK = 0x111122 as ColorResolvable;

const PAGE_SIZE = 1;

/* ─────────────────────────────────────────────────────────────────────────
   HISTORY EMBED BUILDER
───────────────────────────────────────────────────────────────────────── */

function buildHistoryEmbed(event: WarEvent, teams: EventTeam[], page: number, total: number): EmbedBuilder {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const participants = EventParticipantDB.getAll(event.id).length;

  const standings = sorted.map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
    const crown = t.crew_id === event.winner_crew_id ? ' 👑' : '';
    return (
      `${medal}${crown} **[${t.crew_tag}] ${t.crew_name}** — \`${t.score} pts\`\n` +
      `　✅ \`${t.heists_success}\`  ❌ \`${t.heists_failed}\`  ⭐ \`${t.bonus_objectives}\``
    );
  }).join('\n') || '*No teams competed.*';

  let duration = '—';
  if (event.created_at && event.ended_at) {
    const ms = new Date(event.ended_at).getTime() - new Date(event.created_at).getTime();
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const endedAt = event.ended_at
    ? `<t:${Math.floor(new Date(event.ended_at).getTime() / 1000)}:D>`
    : '—';

  return new EmbedBuilder()
    .setColor(teams.length === 0 ? GTA_DARK : GTA_GOLD)
    .setTitle(`📁 OPERATION ARCHIVE — Entry ${page + 1} of ${total}`)
    .setDescription(
      `**${event.title}**\n` +
      `📅 Concluded: ${endedAt} · ⏱️ Duration: \`${duration}\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**📊 Final Standings:**\n${standings}`
    )
    .addFields(
      {
        name: '🏆 Winner',
        value: winner ? `**[${winner.crew_tag}] ${winner.crew_name}** — \`${winner.score} pts\`` : '*No winner*',
        inline: true,
      },
      { name: '👥 Participants', value: `\`${participants}\``, inline: true },
      { name: '⚔️ Crews',        value: `\`${teams.length}\``, inline: true },
      {
        name: '💰 Rewards Issued',
        value: `\`${event.reward_xp} XP\` + \`$${event.reward_coins.toLocaleString()}\` per winning member`,
        inline: false,
      },
    )
    .setFooter({ text: `Event ID: ${event.id.slice(0, 8)} • Use ◀ ▶ to browse past operations` })
    .setTimestamp(new Date(event.ended_at ?? event.created_at));
}

function buildHistoryRows(page: number, total: number): ActionRowBuilder<ButtonBuilder>[] {
  const isFirst = page === 0;
  const isLast  = page >= total - 1;

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ehist:page:${page - 1}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isFirst),
      new ButtonBuilder()
        .setCustomId('ehist:label')
        .setLabel(`📁 ${page + 1} / ${total}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`ehist:page:${page + 1}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isLast),
    ),
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   COMMAND DEFINITION
───────────────────────────────────────────────────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('🚨 Event Control Panel & Operation Archive')
  .addSubcommand(sub =>
    sub.setName('panel').setDescription('Admin: Open the Event Control Panel')
  )
  .addSubcommand(sub =>
    sub.setName('history').setDescription('Browse the archive of past Crew War operations')
  );

/* ─────────────────────────────────────────────────────────────────────────
   COMMAND HANDLER
───────────────────────────────────────────────────────────────────────── */

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  /* ── /event panel ── */
  if (sub === 'panel') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '🚫 This panel is for admins only.', ephemeral: true });
      return;
    }
    await interaction.deferReply();
    const event = WarEventDB.getActive();
    const teams = event ? EventTeamDB.getTeams(event.id) : [];
    await interaction.editReply({
      embeds: [buildControlPanelEmbed(event, teams)],
      components: buildControlPanelRows(event),
    });
    return;
  }

  /* ── /event history ── */
  if (sub === 'history') {
    await interaction.deferReply();

    const total = WarEventDB.countEnded();
    if (total === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(GTA_DARK)
            .setTitle('📁 OPERATION ARCHIVE')
            .setDescription('> No completed operations on record yet.\n> Start and finish a Crew War event to build the history.'),
        ],
      });
      return;
    }

    const [event] = WarEventDB.getHistoryPaged(PAGE_SIZE, 0);
    const teams   = EventTeamDB.getTeams(event.id);

    await interaction.editReply({
      embeds: [buildHistoryEmbed(event, teams, 0, total)],
      components: buildHistoryRows(0, total),
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   EXPORTED BUILDERS  (used by the button router for pagination)
───────────────────────────────────────────────────────────────────────── */

export { buildHistoryEmbed, buildHistoryRows };
