import { EmbedBuilder } from 'discord.js';
import type { Crew, Player, Territory, CrewTransaction, CrewWar } from '../database/schema.js';
import { formatCoins } from '../utils/helpers.js';
import { CREW_UPGRADES } from './upgrades-config.js';
import { CrewUpgradeDB, CrewDB, TerritoryDB } from '../database/db.js';
import { t } from '../utils/i18n.js';

const GOLD   = 0xC8A951;
const RED    = 0xE94560;
const GREEN  = 0x00D26A;
const DARK   = 0x0D0D1A;
const BLUE   = 0x3498DB;
const PURPLE = 0x9B59B6;

const DIVIDER = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

const RISK_ICON: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };
const ROLE_ICON: Record<string, string> = { owner: '👑', officer: '⭐', member: '▪️' };

/* ─── NO-CREW HUB ─── */

export function buildNoCrewEmbed(lang = 'en'): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(DARK)
    .setTitle(t(lang, 'crew.embeds.no_crew.title'))
    .setDescription(
      `${t(lang, 'crew.embeds.no_crew.quote')}\n\n` +
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.no_crew.solo_line')}\n\n` +
      `${t(lang, 'crew.embeds.no_crew.perk_bank')}\n` +
      `${t(lang, 'crew.embeds.no_crew.perk_territory')}\n` +
      `${t(lang, 'crew.embeds.no_crew.perk_wars')}\n` +
      `${t(lang, 'crew.embeds.no_crew.perk_upgrades')}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: t(lang, 'crew.embeds.no_crew.footer') })
    .setTimestamp();
}

/* ─── MAIN CREW HUB ─── */

export function buildHubEmbed(crew: Crew, members: Player[], territories: Territory[], lang = 'en'): EmbedBuilder {
  const repNext = (Math.floor(crew.reputation / 1000) + 1) * 1000;
  const repProgress = Math.round((crew.reputation % 1000) / 1000 * 10);
  const repBar = '█'.repeat(repProgress) + '░'.repeat(10 - repProgress);
  const income = territories.reduce((s, t2) => s + t2.income_per_hour, 0);

  const lv  = t(lang, 'crew.embeds.hub.level_label');
  const rep = t(lang, 'crew.embeds.hub.rep_label');
  const prg = t(lang, 'crew.embeds.hub.progress_label');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`🏴  [${crew.tag}] ${crew.name.toUpperCase()}`)
    .setDescription(`> ${crew.description ?? '*No description set.*'}\n\n${DIVIDER}`)
    .addFields(
      {
        name: t(lang, 'crew.embeds.hub.status_field'),
        value:
          `\`\`\`\n` +
          `${lv.padEnd(10)}: ${crew.level}\n` +
          `${rep.padEnd(10)}: ${crew.reputation.toLocaleString()} / ${repNext.toLocaleString()}\n` +
          `${prg.padEnd(10)}: [${repBar}]\n` +
          `\`\`\``,
        inline: false,
      },
      {
        name: t(lang, 'crew.embeds.hub.finances_field'),
        value:
          `${t(lang, 'crew.embeds.hub.bank_balance')}  **${formatCoins(crew.bank_balance)}**\n` +
          `${t(lang, 'crew.embeds.hub.total_earned')}  **${formatCoins(crew.total_earnings)}**\n` +
          `${t(lang, 'crew.embeds.hub.territory_inc')} **${formatCoins(income)}/hr**`,
        inline: true,
      },
      {
        name: t(lang, 'crew.embeds.hub.operations_field'),
        value:
          `${t(lang, 'crew.embeds.hub.members_active')}    **${members.length}** ${t(lang, 'crew.embeds.hub.active_suffix')}\n` +
          `${t(lang, 'crew.embeds.hub.territories_ctrl')}  **${territories.length}** ${t(lang, 'crew.embeds.hub.controlled_suffix')}\n` +
          `${t(lang, 'crew.embeds.hub.heists_done')}    **${crew.total_heists}** ${t(lang, 'crew.embeds.hub.completed_suffix')}`,
        inline: true,
      }
    )
    .setFooter({ text: `Crew ID: ${crew.id.slice(0, 8)} • GTA Heist RPG` })
    .setTimestamp();
}

/* ─── MEMBERS PANEL ─── */

export function buildMembersEmbed(crew: Crew, members: Player[], page: number, totalPages: number, lang = 'en'): EmbedBuilder {
  const PAGE_SIZE = 5;
  const slice = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const rows = slice.map((m, i) => {
    const icon = ROLE_ICON[m.crew_role] ?? '▪️';
    const pos = page * PAGE_SIZE + i + 1;
    return `**${pos}.** ${icon} **${m.display_name}** — LVL ${m.level} | ${m.rank} | ${formatCoins(m.total_earnings)} ${t(lang, 'crew.embeds.members.earned_suffix')}`;
  }).join('\n') || t(lang, 'crew.embeds.members.no_members');

  return new EmbedBuilder()
    .setColor(BLUE)
    .setTitle(`👥  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.members.header_suffix')}`)
    .setDescription(`${DIVIDER}\n\n${rows}\n\n${DIVIDER}`)
    .setFooter({ text: `Page ${page + 1} / ${totalPages} • ${members.length} total members` })
    .setTimestamp();
}

/* ─── BANK PANEL ─── */

export function buildBankEmbed(crew: Crew, transactions: CrewTransaction[], lang = 'en'): EmbedBuilder {
  const txRows = transactions.length
    ? transactions.map(tx => {
        const sign = tx.type === 'withdraw' ? '−' : '+';
        const color = tx.type === 'withdraw' ? '🔴' : '🟢';
        const time = new Date(tx.created_at).toLocaleDateString();
        return `${color} **${sign}${formatCoins(tx.amount)}** — ${tx.description} *(${time})*`;
      }).join('\n')
    : t(lang, 'crew.embeds.bank.no_tx');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`💰  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.bank.header_suffix')}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.bank.balance_label')}\n` +
      `# ${formatCoins(crew.bank_balance)}\n\n` +
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.bank.tx_header')}\n${txRows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: t(lang, 'crew.embeds.bank.footer') })
    .setTimestamp();
}

/* ─── TERRITORIES PANEL ─── */

export function buildTerritoriesEmbed(crew: Crew, allTerritories: Territory[], lang = 'en'): EmbedBuilder {
  const owned = allTerritories.filter(t2 => t2.control_crew_id === crew.id);
  const totalIncome = owned.reduce((s, t2) => s + t2.income_per_hour, 0);

  const rows = allTerritories.map(t2 => {
    const isOwned = t2.control_crew_id === crew.id;
    const ownerTag = t2.control_crew_id
      ? (isOwned ? `[${crew.tag}] ${t(lang, 'crew.embeds.territories.you_label')}` : t(lang, 'crew.embeds.territories.enemy_label'))
      : t(lang, 'crew.embeds.territories.unclaimed_label');
    const status = isOwned ? '🟢' : t2.control_crew_id ? '🔴' : '⚪';
    const risk = RISK_ICON[t2.risk_level];
    return `${status} **${t2.name}** ${risk} — ${formatCoins(t2.income_per_hour)}/hr — *${ownerTag}*`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(owned.length > 0 ? GREEN : RED)
    .setTitle(`🏴  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.territories.header_suffix')}`)
    .setDescription(
      `${DIVIDER}\n\n${rows}\n\n${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.territories.zones_line')} **${owned.length} / ${allTerritories.length}**\n` +
      `${t(lang, 'crew.embeds.territories.income_line')} **${formatCoins(totalIncome)}/hr**`
    )
    .setFooter({ text: t(lang, 'crew.embeds.territories.footer') })
    .setTimestamp();
}

/* ─── WARS PANEL ─── */

export function buildWarsEmbed(crew: Crew, active: CrewWar[], history: CrewWar[], lang = 'en'): EmbedBuilder {
  const activeRows = active.length
    ? active.map(w => {
        const isAttacker = w.attacker_crew_id === crew.id;
        const statusLabel = w.status === 'pending'
          ? t(lang, 'crew.embeds.wars.pending_label')
          : t(lang, 'crew.embeds.wars.active_label');
        const side = isAttacker
          ? t(lang, 'crew.embeds.wars.attacking_label')
          : t(lang, 'crew.embeds.wars.defending_label');
        return `${statusLabel} | ${side} | Score: **${w.attacker_score}** vs **${w.defender_score}**`;
      }).join('\n')
    : t(lang, 'crew.embeds.wars.no_active');

  const historyRows = history.length
    ? history.map(w => {
        const won = w.winner_crew_id === crew.id;
        const icon = won ? '🏆' : '💀';
        const label = won ? t(lang, 'crew.embeds.wars.victory_label') : t(lang, 'crew.embeds.wars.defeat_label');
        return `${icon} **${label}** — ${w.attacker_score} vs ${w.defender_score}`;
      }).join('\n')
    : t(lang, 'crew.embeds.wars.no_history');

  return new EmbedBuilder()
    .setColor(RED)
    .setTitle(`⚔️  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.wars.header_suffix')}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.wars.active_header')}\n${activeRows}\n\n` +
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.wars.history_header')}\n${historyRows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: t(lang, 'crew.embeds.wars.footer') })
    .setTimestamp();
}

/* ─── UPGRADES PANEL ─── */

export function buildUpgradesEmbed(crew: Crew, lang = 'en'): EmbedBuilder {
  const purchased = CrewUpgradeDB.getAll(crew.id).map(u => u.upgrade_key);

  const rows = Object.values(CREW_UPGRADES).map(u => {
    const owned = purchased.includes(u.key);
    const canAfford = crew.bank_balance >= u.cost;
    const reqMet = !u.requires || purchased.includes(u.requires);
    const status = owned ? '✅' : (!reqMet ? '🔒' : (canAfford ? '🛒' : '💸'));
    return `${status} ${u.icon} **${u.name}** — ${formatCoins(u.cost)}\n　　*${u.description}*${u.requires && !owned ? ` *(Requires: ${CREW_UPGRADES[u.requires as keyof typeof CREW_UPGRADES]?.name ?? u.requires})*` : ''}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle(`📦  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.upgrades.header_suffix')}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.upgrades.bank_balance')} ${formatCoins(crew.bank_balance)}\n\n` +
      `${rows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: t(lang, 'crew.embeds.upgrades.footer') })
    .setTimestamp();
}

/* ─── STATS PANEL ─── */

export function buildStatsEmbed(crew: Crew, members: Player[], globalRank: number, lang = 'en'): EmbedBuilder {
  const richest    = [...members].sort((a, b) => b.coins - a.coins)[0];
  const mostActive = [...members].sort((a, b) => b.total_heists - a.total_heists)[0];
  const territories = TerritoryDB.getControlledBy(crew.id);

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`📊  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.stats.header_suffix')}`)
    .setDescription(`${DIVIDER}`)
    .addFields(
      {
        name: t(lang, 'crew.embeds.stats.global_field'),
        value:
          `> ${t(lang, 'crew.embeds.stats.rank_label')}   **#${globalRank}** ${t(lang, 'crew.embeds.stats.globally')}\n` +
          `> ${t(lang, 'crew.embeds.stats.level_label')}      **${crew.level}**\n` +
          `> ${t(lang, 'crew.embeds.stats.rep_label')} **${crew.reputation.toLocaleString()} REP**`,
        inline: false,
      },
      {
        name: t(lang, 'crew.embeds.stats.finances_field'),
        value:
          `> ${t(lang, 'crew.embeds.stats.total_earnings')}  **${formatCoins(crew.total_earnings)}**\n` +
          `> ${t(lang, 'crew.embeds.stats.bank_balance')}    **${formatCoins(crew.bank_balance)}**\n` +
          `> ${t(lang, 'crew.embeds.stats.territories')}     **${territories.length}** ${t(lang, 'crew.embeds.stats.zones')}`,
        inline: true,
      },
      {
        name: t(lang, 'crew.embeds.stats.ops_field'),
        value:
          `> ${t(lang, 'crew.embeds.stats.heists_run')}  **${crew.total_heists}**\n` +
          `> ${t(lang, 'crew.embeds.stats.crew_size')}   **${members.length}** ${t(lang, 'crew.embeds.stats.members_label')}\n` +
          `> ${t(lang, 'crew.embeds.stats.founded')}     **${new Date(crew.created_at).toLocaleDateString()}**`,
        inline: true,
      },
      {
        name: t(lang, 'crew.embeds.stats.legends_field'),
        value:
          `> ${t(lang, 'crew.embeds.stats.richest_member')}   **${richest?.display_name ?? 'N/A'}** (${formatCoins(richest?.coins ?? 0)})\n` +
          `> ${t(lang, 'crew.embeds.stats.most_active')}      **${mostActive?.display_name ?? 'N/A'}** (${mostActive?.total_heists ?? 0} ${t(lang, 'crew.embeds.stats.heists_suffix')})`,
        inline: false,
      }
    )
    .setFooter({ text: t(lang, 'crew.embeds.stats.footer') })
    .setTimestamp();
}

/* ─── MANAGEMENT PANEL ─── */

export function buildManagementEmbed(crew: Crew, isOwner: boolean, lang = 'en'): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(isOwner ? GOLD : BLUE)
    .setTitle(`⚙️  [${crew.tag}] ${crew.name} ${t(lang, 'crew.embeds.management.header_suffix')}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `${t(lang, 'crew.embeds.management.subtitle')}\n\n` +
      (isOwner
        ? t(lang, 'crew.embeds.management.owner_perms')
        : t(lang, 'crew.embeds.management.member_notice')) +
      `\n\n${DIVIDER}`
    )
    .addFields(
      { name: t(lang, 'crew.embeds.management.name_field'),    value: crew.name,                                 inline: true },
      { name: t(lang, 'crew.embeds.management.tag_field'),     value: `[${crew.tag}]`,                           inline: true },
      { name: t(lang, 'crew.embeds.management.members_field'), value: `${crew.member_count}`,                    inline: true },
      { name: t(lang, 'crew.embeds.management.desc_field'),    value: crew.description ?? t(lang, 'crew.embeds.management.desc_not_set'), inline: false },
    )
    .setFooter({ text: t(lang, 'crew.embeds.management.footer') })
    .setTimestamp();
}

/* ─── BROWSE CREWS ─── */

export function buildBrowseEmbed(crews: Crew[], lang = 'en'): EmbedBuilder {
  const rows = crews.length
    ? crews.slice(0, 10).map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        return `${medal} **[${c.tag}] ${c.name}** — LVL ${c.level} | ${c.member_count} members | ${formatCoins(c.total_earnings)}`;
      }).join('\n')
    : t(lang, 'crew.embeds.browse.no_crews');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(t(lang, 'crew.embeds.browse.title'))
    .setDescription(`${DIVIDER}\n\n${rows}\n\n${DIVIDER}`)
    .setFooter({ text: t(lang, 'crew.embeds.browse.footer') })
    .setTimestamp();
}
