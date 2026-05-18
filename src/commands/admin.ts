import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildMember,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { HeistSystem } from '../systems/heist.js';
import { PlayerDB, HeistDB, CrewDB, checkDBHealth } from '../database/db.js';
import { DIFFICULTY_CONFIG } from '../utils/constants.js';
import { formatCoins, formatNumber, getRank } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import { AdminLogSystem } from '../admin/logs.js';
import { ResetSystem } from '../admin/reset.js';
import { SeasonSystem } from '../admin/season.js';
import { Health } from '../utils/health.js';
import { getMemorySnapshot } from '../utils/process-guard.js';
import { getEventEngine } from '../systems/events.js';
import { ThemeEngine, THEMES, type ThemeId } from '../systems/theme.js';

/* ─────────────────────────── PENDING CONFIRMS ─────────────────────────── */

type PendingAction =
  | { type: 'reset_player'; targetId: string; adminId: string }
  | { type: 'reset_all'; adminId: string }
  | { type: 'reset_crew'; crewId: string; crewName: string; wipeMembers: boolean; adminId: string }
  | { type: 'season_start'; name: string; resetXP: boolean; resetCoins: boolean; adminId: string }
  | { type: 'season_end'; adminId: string };

const pending = new Map<string, { action: PendingAction; expiresAt: number }>();

function storePending(key: string, action: PendingAction): void {
  pending.set(key, { action, expiresAt: Date.now() + 120_000 });
}

function consumePending(key: string): PendingAction | null {
  const entry = pending.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { pending.delete(key); return null; }
  pending.delete(key);
  return entry.action;
}

function confirmRow(key: string, label = '⚠️ CONFIRM'): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`admin_confirm:${key}`).setLabel(label).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`admin_cancel:${key}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
}

/* ─────────────────────────── COMMAND DEFINITION ─────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin control system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // ── Flat subcommands ──
  .addSubcommand(sub =>
    sub.setName('status').setDescription('Live bot health snapshot — uptime, memory, DB, errors')
  )
  .addSubcommand(sub =>
    sub.setName('give-role')
      .setDescription('Grant or remove a Discord role from a player')
      .addUserOption(o =>
        o.setName('player').setDescription('Target player').setRequired(true)
      )
      .addRoleOption(o =>
        o.setName('role').setDescription('Role to grant or remove').setRequired(true)
      )
      .addStringOption(o =>
        o.setName('action')
          .setDescription('Give or remove the role')
          .setRequired(true)
          .addChoices(
            { name: '✅ Give role',   value: 'give' },
            { name: '❌ Remove role', value: 'remove' },
          )
      )
      .addStringOption(o =>
        o.setName('reason').setDescription('Reason (shown in audit log)').setRequired(false).setMaxLength(256)
      )
  )
  .addSubcommand(sub =>
    sub.setName('broadcast')
      .setDescription('Send a styled announcement embed to any channel')
      .addStringOption(o =>
        o.setName('title').setDescription('Embed title').setRequired(true).setMaxLength(256)
      )
      .addStringOption(o =>
        o.setName('message').setDescription('Embed body text').setRequired(true).setMaxLength(2000)
      )
      .addChannelOption(o =>
        o.setName('channel').setDescription('Target channel (defaults to current channel)').setRequired(false)
      )
      .addStringOption(o =>
        o.setName('type')
          .setDescription('Announcement type (controls colour & icon)')
          .setRequired(false)
          .addChoices(
            { name: '📢 General',     value: 'general' },
            { name: '💣 Heist Alert', value: 'heist' },
            { name: '⚙️ Maintenance', value: 'maintenance' },
            { name: '🏆 Season',      value: 'season' },
            { name: '⚠️ Warning',     value: 'warning' },
          )
      )
      .addStringOption(o =>
        o.setName('footer').setDescription('Optional footer text').setRequired(false).setMaxLength(128)
      )
  )
  .addSubcommand(sub =>
    sub.setName('panel').setDescription('Open the admin control panel')
  )
  .addSubcommand(sub =>
    sub.setName('shop').setDescription('Open the shop admin panel — manage items, prices, availability')
  )
  .addSubcommand(sub =>
    sub.setName('theme')
      .setDescription('Control the active world theme (immersion engine)')
      .addStringOption(o =>
        o.setName('action')
          .setDescription('Set a theme or clear the override to revert to auto-detect')
          .setRequired(true)
          .addChoices(
            { name: '🎨 Set theme',       value: 'set'    },
            { name: '🔄 Clear override', value: 'clear'  },
            { name: '📋 Show current',   value: 'status' },
          )
      )
      .addStringOption(o =>
        o.setName('name')
          .setDescription('Theme to activate (required when action = set)')
          .setRequired(false)
          .addChoices(
            { name: '💀 Default Criminal',   value: 'DEFAULT_CRIMINAL'   },
            { name: '🌙 Night Ops',          value: 'NIGHT_OPS'          },
            { name: '🕶️ Black Market',       value: 'BLACK_MARKET'       },
            { name: '🚨 Police Lockdown',    value: 'POLICE_LOCKDOWN'    },
            { name: '🔥 Heat Wave',          value: 'HEAT_WAVE'          },
            { name: '🌧️ Rainy Operations',  value: 'RAINY_OPERATIONS'   },
            { name: '🩸 Blood Money',        value: 'BLOOD_MONEY'        },
            { name: '🎄 Christmas Heist',    value: 'CHRISTMAS_HEIST'    },
            { name: '🌙 Ramadan Nights',     value: 'RAMADAN_NIGHTS'     },
            { name: '⚡ Double XP Weekend',  value: 'DOUBLE_XP_WEEKEND'  },
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('pending')
      .setDescription('View pending heist submissions')
      .addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName('inspect')
      .setDescription('Inspect a heist submission by ID')
      .addStringOption(o => o.setName('id').setDescription('Submission ID (or prefix)').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('View recent admin action logs')
      .addIntegerOption(o => o.setName('limit').setDescription('How many entries (default 15)').setRequired(false).setMinValue(1).setMaxValue(50))
  )

  // ── Player group ──
  .addSubcommandGroup(group =>
    group.setName('player').setDescription('Player management')
      .addSubcommand(sub =>
        sub.setName('give-xp')
          .setDescription('Award XP to a player')
          .addUserOption(o => o.setName('player').setDescription('Target').setRequired(true))
          .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(100000))
          .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName('give-coins')
          .setDescription('Award coins to a player')
          .addUserOption(o => o.setName('player').setDescription('Target').setRequired(true))
          .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(10000000))
          .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName('lookup')
          .setDescription("Look up a player's full profile")
          .addUserOption(o => o.setName('player').setDescription('Target').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('reset')
          .setDescription('Reset a player\'s stats to default')
          .addUserOption(o => o.setName('player').setDescription('Target').setRequired(true))
          .addIntegerOption(o => o.setName('starting-coins').setDescription('Starting coins after reset (default 1000)').setRequired(false).setMinValue(0))
      )
      .addSubcommand(sub =>
        sub.setName('reset-streak')
          .setDescription("Reset a player's daily streak")
          .addUserOption(o => o.setName('player').setDescription('Target').setRequired(true))
      )
  )

  // ── Reset group ──
  .addSubcommandGroup(group =>
    group.setName('reset').setDescription('Bulk reset operations')
      .addSubcommand(sub =>
        sub.setName('all')
          .setDescription('⚠️ Reset ALL players — IRREVERSIBLE')
      )
      .addSubcommand(sub =>
        sub.setName('crew')
          .setDescription('Reset a crew\'s stats and territories')
          .addStringOption(o => o.setName('name').setDescription('Crew name').setRequired(true))
          .addBooleanOption(o => o.setName('wipe-members').setDescription('Remove all members except owner').setRequired(false))
      )
  )

  // ── Season group ──
  .addSubcommandGroup(group =>
    group.setName('season').setDescription('Season management')
      .addSubcommand(sub =>
        sub.setName('start')
          .setDescription('Start a new season (ends current season if active)')
          .addStringOption(o => o.setName('name').setDescription('Season name').setRequired(true).setMaxLength(64))
          .addBooleanOption(o => o.setName('reset-xp').setDescription('Reset all player XP/level? (default true)').setRequired(false))
          .addBooleanOption(o => o.setName('reset-coins').setDescription('Reset all player coins to 1000? (default false)').setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName('end')
          .setDescription('End the current active season')
      )
      .addSubcommand(sub =>
        sub.setName('status')
          .setDescription('Show current season info and history')
      )
  );

/* ─────────────────────────── EXECUTE ─────────────────────────── */

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();
  const adminId = interaction.user.id;

  /* ════════════════ FLAT SUBCOMMANDS ════════════════ */

  if (!group) {

    if (sub === 'status') {
      const snap   = Health.getSnapshot();
      const mem    = getMemorySnapshot();
      const db     = checkDBHealth();
      const engine = getEventEngine();

      const totalPlayers  = PlayerDB.countAll();
      const totalCrews    = CrewDB.countAll();
      const pendingHeists = HeistDB.countPending();

      const statusColor = db.ok ? 0x00D26A : 0xFF4757;
      const dbLine      = db.ok ? '🟢 Connected' : `🔴 ERROR — ${db.error ?? 'unknown'}`;
      const engineLine  = engine ? '🟢 Running' : '🔴 Offline';
      const envLine     = snap.environment === 'production' ? '🚀 Production' : `🛠️ ${snap.environment}`;

      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📊  BOT STATUS — Live Health Snapshot')
        .addFields(
          { name: '⏱️ Uptime',           value: snap.uptimeHuman,                    inline: true },
          { name: '🌍 Environment',       value: envLine,                             inline: true },
          { name: '🆔 PID',              value: String(process.pid),                 inline: true },
          { name: '🗄️ Database',         value: dbLine,                              inline: true },
          { name: '⚙️ Event Engine',     value: engineLine,                          inline: true },
          { name: '🔢 Node.js',          value: process.version,                     inline: true },
          { name: '🧠 Heap Memory',      value: `${mem.heapMB} MB`,                  inline: true },
          { name: '📦 RSS Memory',        value: `${mem.rssMB} MB`,                   inline: true },
          { name: '🔌 External Memory',  value: `${mem.externalMB} MB`,              inline: true },
          { name: '🎮 Interactions',      value: String(snap.interactionsProcessed),  inline: true },
          { name: '❌ Errors Logged',    value: String(snap.errorsTotal),            inline: true },
          { name: '🗃️ DB Queries',       value: String(snap.dbQueriesTotal),         inline: true },
          { name: '👥 Players',           value: String(totalPlayers),               inline: true },
          { name: '🏴 Crews',            value: String(totalCrews),                  inline: true },
          { name: '📋 Pending Heists',   value: String(pendingHeists),               inline: true },
          { name: '🕐 Started At',        value: `<t:${Math.floor(new Date(snap.startedAt).getTime() / 1000)}:f>`, inline: false },
          ...(snap.idleSecondsSinceLastInteraction != null
            ? [{ name: '💤 Last Activity', value: `${snap.idleSecondsSinceLastInteraction}s ago`, inline: true }]
            : []),
        )
        .setFooter({ text: 'GTA Heist RPG • System Health' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'give-role') {
      const target = interaction.options.getUser('player', true);
      const role   = interaction.options.getRole('role', true);
      const action = interaction.options.getString('action', true) as 'give' | 'remove';
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      // Resolve the GuildMember — needed to add/remove roles
      const guild = interaction.guild;
      if (!guild) { await interaction.editReply('❌ This command must be used inside a server.'); return; }

      let member: GuildMember;
      try {
        member = await guild.members.fetch(target.id);
      } catch {
        await interaction.editReply(`❌ Could not find **${target.displayName}** in this server.`);
        return;
      }

      // Prevent managing roles higher than or equal to the bot's highest role
      const botMember = guild.members.me;
      if (!botMember) { await interaction.editReply('❌ Cannot resolve bot member.'); return; }

      if (role.position >= botMember.roles.highest.position) {
        await interaction.editReply(
          `❌ I cannot manage **@${role.name}** — it is equal to or higher than my highest role.\n` +
          `Move my role above **@${role.name}** in Server Settings → Roles, then try again.`
        );
        return;
      }

      // Prevent managing roles equal to or above the admin's highest role (safety guard)
      const adminMember = interaction.member as GuildMember | null;
      if (adminMember && role.position >= adminMember.roles.highest.position) {
        await interaction.editReply(
          `❌ You cannot manage **@${role.name}** — it is equal to or above your highest role.`
        );
        return;
      }

      const alreadyHas = member.roles.cache.has(role.id);

      if (action === 'give') {
        if (alreadyHas) {
          await interaction.editReply(`ℹ️ **${member.displayName}** already has **@${role.name}**.`);
          return;
        }
        try {
          await member.roles.add(role.id, `[Admin] ${adminId}: ${reason}`);
        } catch (err) {
          logger.error('[Admin] Role add failed:', err);
          await interaction.editReply(`❌ Failed to add role — check bot permissions.`);
          return;
        }
      } else {
        if (!alreadyHas) {
          await interaction.editReply(`ℹ️ **${member.displayName}** does not have **@${role.name}**.`);
          return;
        }
        try {
          await member.roles.remove(role.id, `[Admin] ${adminId}: ${reason}`);
        } catch (err) {
          logger.error('[Admin] Role remove failed:', err);
          await interaction.editReply(`❌ Failed to remove role — check bot permissions.`);
          return;
        }
      }

      AdminLogSystem.log({
        adminId,
        actionType: action === 'give' ? 'give_role' : 'remove_role',
        target: target.id,
        details: { roleId: role.id, roleName: role.name, action, reason },
      });

      const isGive  = action === 'give';
      const color   = isGive ? 0x00D26A : 0xFF4757;
      const verb    = isGive ? 'granted' : 'removed';
      const prepos  = isGive ? 'to'      : 'from';

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(color)
          .setTitle(`${isGive ? '✅' : '❌'} Role ${verb.charAt(0).toUpperCase() + verb.slice(1)}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Player',  value: `<@${target.id}>`,  inline: true },
            { name: 'Role',    value: `<@&${role.id}>`,   inline: true },
            { name: 'Action',  value: `${isGive ? '✅ Given' : '❌ Removed'} ${prepos} ${member.displayName}`, inline: true },
            { name: 'Reason',  value: reason,              inline: false },
          )
          .setFooter({ text: `Admin: ${interaction.user.username} • GTA Heist RPG` })
          .setTimestamp()],
      });
      return;
    }

    if (sub === 'broadcast') {
      const title      = interaction.options.getString('title', true).trim();
      const message    = interaction.options.getString('message', true).trim();
      const type       = interaction.options.getString('type') ?? 'general';
      const footerText = interaction.options.getString('footer')?.trim() ?? null;
      const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;

      if (!targetChannel || !('send' in targetChannel)) {
        await interaction.editReply('❌ Cannot send to that channel. Make sure it is a text channel.');
        return;
      }

      type BroadcastType = 'general' | 'heist' | 'maintenance' | 'season' | 'warning';

      const BROADCAST_STYLES: Record<BroadcastType, { color: number; icon: string; label: string }> = {
        general:     { color: 0xC8A951, icon: '📢', label: 'Announcement'  },
        heist:       { color: 0xE94560, icon: '💣', label: 'Heist Alert'   },
        maintenance: { color: 0x8B8FA8, icon: '⚙️', label: 'Maintenance'   },
        season:      { color: 0xFFD700, icon: '🏆', label: 'Season Update' },
        warning:     { color: 0xFF6B00, icon: '⚠️', label: 'Warning'       },
      };

      const style = BROADCAST_STYLES[type as BroadcastType] ?? BROADCAST_STYLES.general;

      const broadcastEmbed = new EmbedBuilder()
        .setColor(style.color)
        .setTitle(`${style.icon}  ${title}`)
        .setDescription(message)
        .setFooter({ text: footerText ?? `GTA Heist RPG • ${style.label}` })
        .setTimestamp();

      try {
        const sent = await (targetChannel as import('discord.js').TextChannel).send({ embeds: [broadcastEmbed] });

        AdminLogSystem.log({
          adminId,
          actionType: 'broadcast',
          target: targetChannel.id,
          details: { title, type, messageLength: message.length, messageUrl: sent.url },
        });

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x00D26A)
            .setTitle('✅ Broadcast Sent')
            .addFields(
              { name: 'Channel',  value: `<#${targetChannel.id}>`, inline: true },
              { name: 'Type',     value: `${style.icon} ${style.label}`, inline: true },
              { name: 'Link',     value: `[Jump to message](${sent.url})`, inline: true },
            )
            .setTimestamp()],
        });
      } catch (err) {
        logger.error('[Admin] Broadcast send failed:', err);
        await interaction.editReply('❌ Failed to send the broadcast. Check that I have permission to post in that channel.');
      }
      return;
    }

    if (sub === 'shop') {
      const { ShopItemDB } = await import('../database/db.js');
      const { buildAdminPanelEmbed } = await import('../shop-ui/embeds.js');
      const { buildAdminPanelRows } = await import('../shop-ui/buttons.js');

      const allItems = ShopItemDB.getAll();
      const PAGE_SIZE = 5;
      const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
      const stats = ShopItemDB.getAnalytics();

      const embed = buildAdminPanelEmbed(allItems, 0, totalPages, stats);
      const rows = buildAdminPanelRows(allItems, 0, totalPages);

      await interaction.editReply({ embeds: [embed], components: rows });
      return;
    }

    if (sub === 'panel') {
      const totalPlayers = PlayerDB.countAll();
      const totalCrews = CrewDB.countAll();
      const pendingCount = HeistDB.countPending();
      const season = SeasonSystem.getActiveSeason();

      const embed = new EmbedBuilder()
        .setColor(0xC8A951)
        .setTitle('🎛️  ADMIN CONTROL PANEL')
        .setDescription('Game Master console for GTA Heist RPG.')
        .addFields(
          { name: '👥 Total Players', value: String(totalPlayers), inline: true },
          { name: '🏴 Total Crews', value: String(totalCrews), inline: true },
          { name: '📋 Pending Heists', value: String(pendingCount), inline: true },
          { name: '📅 Active Season', value: season ? `**${season.name}** (started <t:${Math.floor(new Date(season.started_at).getTime() / 1000)}:R>)` : 'None', inline: false },
        )
        .addFields({
          name: '⚙️ Available Commands',
          value: [
            '`/admin player give-xp/give-coins/lookup/reset/reset-streak`',
            '`/admin reset all` · `/admin reset crew <name>`',
            '`/admin season start/end/status`',
            '`/admin pending` · `/admin inspect <id>` · `/admin logs`',
          ].join('\n'),
        })
        .setFooter({ text: 'GTA Heist RPG • Admin Console' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_panel:logs').setLabel('📜 Recent Logs').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_panel:pending').setLabel('📋 Pending').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_panel:season').setLabel('📅 Season').setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === 'pending') {
      const page = (interaction.options.getInteger('page') ?? 1) - 1;
      const pageSize = 8;
      const allPending = HeistDB.findPending();
      const total = allPending.length;

      if (total === 0) {
        await interaction.editReply('✅ No pending submissions. Queue is clear.');
        return;
      }

      const slice = allPending.slice(page * pageSize, (page + 1) * pageSize);
      const totalPages = Math.ceil(total / pageSize);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xFFA502)
          .setTitle(`📋 Pending Submissions (${total})`)
          .setDescription(
            slice.map((s, i) => {
              const diff = DIFFICULTY_CONFIG[s.difficulty as keyof typeof DIFFICULTY_CONFIG];
              return [
                `**${page * pageSize + i + 1}.** \`${s.id.slice(0, 8)}\``,
                `> **${s.heist_name}** — ${diff?.label ?? s.difficulty}`,
                `> By <@${s.submitter_id}> • ${timeAgo(s.created_at)}`,
              ].join('\n');
            }).join('\n\n')
          )
          .setFooter({ text: `Page ${page + 1}/${totalPages}` })
          .setTimestamp()],
      });
      return;
    }

    if (sub === 'inspect') {
      const id = interaction.options.getString('id', true).trim();
      const submission = HeistDB.findById(id) ?? HeistDB.findPending().find(s => s.id.startsWith(id));
      if (!submission) { await interaction.editReply(`❌ No submission \`${id}\` found.`); return; }

      const diff = DIFFICULTY_CONFIG[submission.difficulty as keyof typeof DIFFICULTY_CONFIG];
      const teammates = HeistSystem.getTeammates(submission);
      const statusEmoji = submission.status === 'approved' ? '✅' : submission.status === 'rejected' ? '❌' : '⏳';

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(submission.status === 'approved' ? 0x00D26A : submission.status === 'rejected' ? 0xFF4757 : 0xC8A951)
          .setTitle(`${statusEmoji} ${submission.heist_name}`)
          .addFields(
            { name: 'ID', value: `\`${submission.id}\``, inline: false },
            { name: 'Status', value: submission.status.toUpperCase(), inline: true },
            { name: 'Difficulty', value: diff?.label ?? submission.difficulty, inline: true },
            { name: 'Submitted', value: `<t:${Math.floor(new Date(submission.created_at).getTime() / 1000)}:R>`, inline: true },
            { name: 'Submitter', value: `<@${submission.submitter_id}>`, inline: true },
            { name: 'Teammates', value: teammates.length ? teammates.map(t => `<@${t}>`).join(', ') : 'Solo', inline: true },
            { name: 'Proof', value: `[View](${submission.proof_url})`, inline: true },
            ...(submission.notes ? [{ name: 'Notes', value: submission.notes, inline: false }] : []),
            ...(submission.reviewer_id ? [
              { name: 'Reviewed By', value: `<@${submission.reviewer_id}>`, inline: true },
              { name: 'Reviewed At', value: `<t:${Math.floor(new Date(submission.reviewed_at!).getTime() / 1000)}:f>`, inline: true },
            ] : []),
            ...(submission.xp_awarded != null ? [
              { name: 'XP Awarded', value: `+${formatNumber(submission.xp_awarded)} XP`, inline: true },
              { name: 'Coins', value: formatCoins(submission.coins_awarded!), inline: true },
            ] : []),
          ).setTimestamp()],
      });
      return;
    }

    if (sub === 'logs') {
      const limit = interaction.options.getInteger('limit') ?? 15;
      const logs = AdminLogSystem.getRecent(limit);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x8B8FA8)
          .setTitle('📜 Admin Action Log')
          .setDescription(AdminLogSystem.formatForEmbed(logs))
          .setFooter({ text: `Last ${limit} actions` })
          .setTimestamp()],
      });
      return;
    }

    if (sub === 'theme') {
      const themeAction = interaction.options.getString('action', true) as 'set' | 'clear' | 'status';

      if (themeAction === 'clear') {
        ThemeEngine.setOverride(null);
        AdminLogSystem.log({ adminId, actionType: 'broadcast', target: 'system', details: { note: 'Theme override cleared' } });
        const autoTheme = ThemeEngine.getActive();
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(autoTheme.primaryColor)
            .setTitle('🔄 Theme Override Cleared')
            .setDescription(`Auto-detect is now active.\nCurrent theme: **${autoTheme.emoji} ${autoTheme.name}**\n*${autoTheme.randomAtmosphere()}*`)
            .setFooter({ text: 'GTA Heist RPG • Theme Engine' })
            .setTimestamp()],
        });
        return;
      }

      if (themeAction === 'status') {
        const active = ThemeEngine.getActive();
        const override = ThemeEngine.getOverride();
        const lines = ThemeEngine.allIds().map(id => {
          const t = THEMES[id];
          const indicator = id === active.id ? '▶️' : '   ';
          return `${indicator} ${t.emoji} **${t.name}**${id === override ? ' *(manual)*' : ''}`;
        });
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(active.primaryColor)
            .setTitle(`${active.emoji} World Theme — Current & Available`)
            .setDescription(lines.join('\n'))
            .addFields({
              name: 'Detection Mode',
              value: override ? `🔒 Manual override: **${override}**` : '🤖 Auto-detect (date/time based)',
              inline: false,
            })
            .setFooter({ text: `${active.footerSuffix || 'GTA Heist RPG • Theme Engine'}` })
            .setTimestamp()],
        });
        return;
      }

      if (themeAction === 'set') {
        const themeName = interaction.options.getString('name') as ThemeId | null;
        if (!themeName) {
          await interaction.editReply('❌ You must also provide a `name` when using `set`.');
          return;
        }
        ThemeEngine.setOverride(themeName);
        const theme = ThemeEngine.getActive();
        AdminLogSystem.log({ adminId, actionType: 'broadcast', target: 'system', details: { note: `Theme set to ${themeName}` } });
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(theme.primaryColor)
            .setTitle(`${theme.emoji} World Theme Updated`)
            .setDescription(`Active theme: **${theme.name}**\n\n*${theme.randomAtmosphere()}*`)
            .addFields(
              { name: 'XP Multiplier',   value: `${theme.xpMultiplier}x`,   inline: true },
              { name: 'Coin Multiplier', value: `${theme.coinMultiplier}x`,  inline: true },
              { name: 'Mode',            value: '🔒 Manual Override',        inline: true },
            )
            .setFooter({ text: `${theme.footerSuffix || 'GTA Heist RPG • Theme Engine'}` })
            .setTimestamp()],
        });
        return;
      }
    }
  }

  /* ════════════════ PLAYER GROUP ════════════════ */

  if (group === 'player') {

    if (sub === 'give-xp') {
      const target = interaction.options.getUser('player', true);
      const amount = interaction.options.getInteger('amount', true);
      const reason = interaction.options.getString('reason') ?? 'Admin grant';

      PlayerSystem.getOrCreate(target.id, target.displayName, target.displayAvatarURL({ extension: 'png', size: 256 }));
      const result = PlayerSystem.adminGiveXP(target.id, amount);
      const player = PlayerDB.findByDiscordId(target.id)!;

      AdminLogSystem.log({ adminId, actionType: 'give_xp', target: target.id, details: { amount, reason } });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xC8A951).setTitle('✅ XP Awarded')
          .addFields(
            { name: 'Player', value: `<@${target.id}>`, inline: true },
            { name: 'XP Added', value: `+${formatNumber(amount)}`, inline: true },
            { name: 'New Total', value: `${formatNumber(player.xp)} XP`, inline: true },
            { name: 'Level', value: String(player.level), inline: true },
            { name: 'Leveled Up', value: result.leveledUp ? `→ Level ${result.newLevel}` : 'No', inline: true },
            { name: 'Rank Change', value: result.rankChanged ? `→ ${result.newRank}` : 'No', inline: true },
            { name: 'Reason', value: reason },
          ).setTimestamp()],
      });
      return;
    }

    if (sub === 'give-coins') {
      const target = interaction.options.getUser('player', true);
      const amount = interaction.options.getInteger('amount', true);
      const reason = interaction.options.getString('reason') ?? 'Admin grant';

      PlayerSystem.getOrCreate(target.id, target.displayName, target.displayAvatarURL({ extension: 'png', size: 256 }));
      PlayerSystem.giveCoins(target.id, amount);
      const player = PlayerDB.findByDiscordId(target.id)!;

      AdminLogSystem.log({ adminId, actionType: 'give_coins', target: target.id, details: { amount, reason } });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('✅ Coins Awarded')
          .addFields(
            { name: 'Player', value: `<@${target.id}>`, inline: true },
            { name: 'Coins Added', value: formatCoins(amount), inline: true },
            { name: 'New Balance', value: formatCoins(player.coins), inline: true },
            { name: 'Reason', value: reason },
          ).setTimestamp()],
      });
      return;
    }

    if (sub === 'lookup') {
      const target = interaction.options.getUser('player', true);
      const player = PlayerDB.findByDiscordId(target.id);
      if (!player) { await interaction.editReply(`❌ **${target.displayName}** has no profile.`); return; }

      const rank = getRank(player.level);
      const globalRank = PlayerSystem.getPlayerRank(target.id);

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xC8A951)
          .setTitle(`Admin Lookup: ${player.display_name}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Discord ID', value: `\`${player.discord_id}\``, inline: true },
            { name: 'Global Rank', value: `#${globalRank}`, inline: true },
            { name: 'Level / XP', value: `${player.level} / ${formatNumber(player.xp)} XP`, inline: true },
            { name: 'Coins', value: formatCoins(player.coins), inline: true },
            { name: 'Rank', value: `${rank.icon} ${rank.name}`, inline: true },
            { name: 'Heists', value: `${player.total_heists} total (${player.successful_heists} ✓)`, inline: true },
            { name: 'Streak', value: `${player.streak_current} days (best: ${player.streak_longest})`, inline: true },
            { name: 'Crew', value: player.crew_id ?? 'None', inline: true },
            { name: 'Joined', value: `<t:${Math.floor(new Date(player.created_at).getTime() / 1000)}:D>`, inline: true },
          ).setTimestamp()],
      });
      return;
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('player', true);
      const startingCoins = interaction.options.getInteger('starting-coins') ?? 1000;
      const player = PlayerDB.findByDiscordId(target.id);
      if (!player) { await interaction.editReply(`❌ **${target.displayName}** has no profile.`); return; }

      const key = `${adminId}_reset_player_${target.id}`;
      storePending(key, { type: 'reset_player', targetId: target.id, adminId });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF4757)
          .setTitle('⚠️ Confirm Player Reset')
          .setDescription(
            `You are about to **fully reset** <@${target.id}>.\n\n` +
            `**Current stats:**\n` +
            `> Level ${player.level} · ${formatNumber(player.xp)} XP · ${formatCoins(player.coins)}\n\n` +
            `**After reset:**\n> Level 1 · 0 XP · ${formatCoins(startingCoins)}\n\n` +
            `All heist history, streaks, and rank will be wiped.\n**This cannot be undone.**`
          ).setTimestamp()],
        components: [confirmRow(key, '⚠️ RESET PLAYER')],
      });
      return;
    }

    if (sub === 'reset-streak') {
      const target = interaction.options.getUser('player', true);
      const player = PlayerDB.findByDiscordId(target.id);
      if (!player) { await interaction.editReply(`❌ **${target.displayName}** has no profile.`); return; }

      PlayerDB.update(target.id, { streak_current: 0 });
      AdminLogSystem.log({ adminId, actionType: 'reset_streak', target: target.id, details: { was: player.streak_current } });

      await interaction.editReply(`✅ Streak reset for **${player.display_name}** (was **${player.streak_current}** days).`);
      return;
    }
  }

  /* ════════════════ RESET GROUP ════════════════ */

  if (group === 'reset') {

    if (sub === 'all') {
      const totalPlayers = PlayerDB.countAll();
      const key = `${adminId}_reset_all`;
      storePending(key, { type: 'reset_all', adminId });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF4757)
          .setTitle('☢️ GLOBAL RESET — CONFIRM')
          .setDescription(
            `This will reset **all ${totalPlayers} players** to zero.\n\n` +
            `Every player's XP, level, coins, heist history, and streaks will be wiped.\n\n` +
            `⚠️ **This action is permanent and cannot be undone.**\n` +
            `Confirmation expires in 2 minutes.`
          ).setTimestamp()],
        components: [confirmRow(key, '☢️ RESET ALL PLAYERS')],
      });
      return;
    }

    if (sub === 'crew') {
      const crewName = interaction.options.getString('name', true).trim();
      const wipeMembers = interaction.options.getBoolean('wipe-members') ?? false;
      const crew = CrewDB.findByName(crewName);

      if (!crew) { await interaction.editReply(`❌ No crew named **${crewName}** found.`); return; }

      const key = `${adminId}_reset_crew_${crew.id}`;
      storePending(key, { type: 'reset_crew', crewId: crew.id, crewName: crew.name, wipeMembers, adminId });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF4757)
          .setTitle(`⚠️ Reset Crew — ${crew.name}`)
          .setDescription(
            `**What will be reset:**\n` +
            `> Bank balance (${formatCoins(crew.bank_balance)}) → $0\n` +
            `> Reputation (${crew.reputation}) → 0\n` +
            `> Level (${crew.level}) → 1\n` +
            `> Territory control → released\n` +
            `> Heist/earnings history → zeroed\n` +
            (wipeMembers ? `> **All members except owner will be removed**\n` : '') +
            `\n**This cannot be undone.**`
          ).setTimestamp()],
        components: [confirmRow(key, '⚠️ RESET CREW')],
      });
      return;
    }
  }

  /* ════════════════ SEASON GROUP ════════════════ */

  if (group === 'season') {

    if (sub === 'start') {
      const name = interaction.options.getString('name', true).trim();
      const resetXP = interaction.options.getBoolean('reset-xp') ?? true;
      const resetCoins = interaction.options.getBoolean('reset-coins') ?? false;
      const totalPlayers = PlayerDB.countAll();
      const active = SeasonSystem.getActiveSeason();

      const key = `${adminId}_season_start`;
      storePending(key, { type: 'season_start', name, resetXP, resetCoins, adminId });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF4757)
          .setTitle(`⚠️ Start Season — "${name}"`)
          .setDescription(
            (active ? `⚡ **Current season "${active.name}" will be ended automatically.**\n\n` : '') +
            `**Resets applied to all ${totalPlayers} players:**\n` +
            `> XP + Level: ${resetXP ? '✅ Reset to 0' : '❌ Kept'}\n` +
            `> Coins: ${resetCoins ? '✅ Reset to $1,000' : '❌ Kept'}\n` +
            `> Streaks: ✅ Reset\n` +
            `> Territories: ✅ Released\n` +
            `> Crew bank/rep/level: ✅ Reset\n\n` +
            `**This cannot be undone.**`
          ).setTimestamp()],
        components: [confirmRow(key, '▶️ START SEASON')],
      });
      return;
    }

    if (sub === 'end') {
      const active = SeasonSystem.getActiveSeason();
      if (!active) { await interaction.editReply('❌ No active season to end.'); return; }

      const key = `${adminId}_season_end`;
      storePending(key, { type: 'season_end', adminId });

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFFA502)
          .setTitle(`⚠️ End Season — "${active.name}"`)
          .setDescription(
            `The current season **"${active.name}"** will be ended.\n\n` +
            `A final leaderboard snapshot will be saved.\n` +
            `No player data will be reset — use \`/admin season start\` to begin a fresh season.`
          ).setTimestamp()],
        components: [confirmRow(key, '⏹ END SEASON')],
      });
      return;
    }

    if (sub === 'status') {
      const active = SeasonSystem.getActiveSeason();
      const history = SeasonSystem.getHistory(5);

      const embed = new EmbedBuilder().setColor(0xC8A951).setTitle('📅 Season Status');

      if (active) {
        embed.addFields({
          name: '🟢 Active Season',
          value: `**${active.name}**\nStarted <t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>`,
        });
      } else {
        embed.setDescription('No active season running.');
      }

      const past = history.filter(s => s.status === 'ended');
      if (past.length) {
        embed.addFields({
          name: '📁 Past Seasons',
          value: past.map(s => {
            const top = SeasonSystem.getTopFromSeason(s);
            const winner = top[0]?.display_name ?? 'Unknown';
            return `**${s.name}** — ended <t:${Math.floor(new Date(s.ended_at!).getTime() / 1000)}:D> · 🏆 ${winner}`;
          }).join('\n'),
        });
      }

      embed.setFooter({ text: 'GTA Heist RPG • Season System' }).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }
}

/* ─────────────────────────── BUTTON HANDLER ─────────────────────────── */

export async function handleAdminButton(button: ButtonInteraction): Promise<void> {
  const [action, key] = button.customId.split(':');

  /* ─── PANEL SHORTCUTS ─── */
  if (action === 'admin_panel') {
    await button.deferReply({ ephemeral: true });

    if (key === 'logs') {
      const logs = AdminLogSystem.getRecent(15);
      await button.editReply({
        embeds: [new EmbedBuilder().setColor(0x8B8FA8)
          .setTitle('📜 Recent Admin Actions')
          .setDescription(AdminLogSystem.formatForEmbed(logs))
          .setTimestamp()],
      });
      return;
    }

    if (key === 'pending') {
      const count = HeistDB.countPending();
      await button.editReply({
        content: count > 0
          ? `📋 **${count}** pending submission${count !== 1 ? 's' : ''}. Use \`/admin pending\` to review them.`
          : '✅ No pending submissions.',
      });
      return;
    }

    if (key === 'season') {
      const active = SeasonSystem.getActiveSeason();
      await button.editReply({
        embeds: [new EmbedBuilder().setColor(0xC8A951)
          .setTitle('📅 Season Status')
          .setDescription(active
            ? `**Active:** ${active.name}\nStarted <t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>`
            : 'No active season. Use `/admin season start` to begin one.')
          .setTimestamp()],
      });
      return;
    }
    return;
  }

  /* ─── CANCEL ─── */
  if (action === 'admin_cancel') {
    consumePending(key);
    await button.update({ content: '❌ Action cancelled.', embeds: [], components: [] });
    return;
  }

  /* ─── CONFIRM ─── */
  if (action === 'admin_confirm') {
    const pa = consumePending(key);
    if (!pa) {
      await button.update({ content: '⏰ This confirmation has expired. Run the command again.', embeds: [], components: [] });
      return;
    }

    // Verify the confirming admin is the same one who initiated
    if (pa.adminId !== button.user.id) {
      await button.reply({ content: '🚫 Only the admin who initiated this action can confirm it.', ephemeral: true });
      return;
    }

    await button.deferUpdate();

    try {
      if (pa.type === 'reset_player') {
        ResetSystem.resetPlayer(pa.targetId, pa.adminId);
        await button.editReply({
          embeds: [new EmbedBuilder().setColor(0x00D26A)
            .setTitle('✅ Player Reset Complete')
            .setDescription(`<@${pa.targetId}> has been reset to Level 1, 0 XP, $1,000 coins.`)
            .setTimestamp()],
          components: [],
        });
        return;
      }

      if (pa.type === 'reset_all') {
        const affected = ResetSystem.resetAllPlayers(pa.adminId);
        await button.editReply({
          embeds: [new EmbedBuilder().setColor(0x00D26A)
            .setTitle('✅ Global Reset Complete')
            .setDescription(`**${affected}** players reset to Level 1, 0 XP, $1,000 coins.`)
            .setTimestamp()],
          components: [],
        });
        return;
      }

      if (pa.type === 'reset_crew') {
        ResetSystem.resetCrew(pa.crewId, pa.adminId, { wipeMembers: pa.wipeMembers });
        await button.editReply({
          embeds: [new EmbedBuilder().setColor(0x00D26A)
            .setTitle(`✅ Crew Reset — ${pa.crewName}`)
            .setDescription(`Bank, reputation, level, and territories wiped.${pa.wipeMembers ? '\nAll members removed except the owner.' : ''}`)
            .setTimestamp()],
          components: [],
        });
        return;
      }

      if (pa.type === 'season_start') {
        const season = SeasonSystem.startSeason({ name: pa.name, resetXP: pa.resetXP, resetCoins: pa.resetCoins }, pa.adminId);
        await button.editReply({
          embeds: [new EmbedBuilder().setColor(0x00D26A)
            .setTitle(`✅ Season "${pa.name}" Started`)
            .setDescription(`Season #${season.id} is now active.\nXP reset: **${pa.resetXP ? 'Yes' : 'No'}** · Coins reset: **${pa.resetCoins ? 'Yes' : 'No'}**`)
            .setTimestamp()],
          components: [],
        });
        return;
      }

      if (pa.type === 'season_end') {
        const season = SeasonSystem.endSeason(pa.adminId);
        const top = SeasonSystem.getTopFromSeason(season);
        const podium = top.slice(0, 3).map((p, i) => `${['🥇','🥈','🥉'][i]} ${p.display_name} — LVL ${p.level}`).join('\n');

        await button.editReply({
          embeds: [new EmbedBuilder().setColor(0xC8A951)
            .setTitle(`🏁 Season "${season.name}" Ended`)
            .addFields({ name: '🏆 Top 3', value: podium || 'No results.' })
            .setTimestamp()],
          components: [],
        });
        return;
      }

    } catch (err) {
      logger.error('Admin confirm action failed:', err);
      await button.editReply({
        content: `❌ ${err instanceof Error ? err.message : 'Action failed. Check logs.'}`,
        embeds: [],
        components: [],
      });
    }
  }
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
