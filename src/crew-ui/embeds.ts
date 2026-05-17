import { EmbedBuilder } from 'discord.js';
import type { Crew, Player, Territory, CrewTransaction, CrewWar } from '../database/schema.js';
import { formatCoins } from '../utils/helpers.js';
import { CREW_UPGRADES } from './upgrades-config.js';
import { CrewUpgradeDB, CrewDB, TerritoryDB } from '../database/db.js';

const GOLD = 0xC8A951;
const RED = 0xE94560;
const GREEN = 0x00D26A;
const DARK = 0x0D0D1A;
const BLUE = 0x3498DB;
const PURPLE = 0x9B59B6;

const DIVIDER = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

const RISK_ICON: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };
const ROLE_ICON: Record<string, string> = { owner: '👑', officer: '⭐', member: '▪️' };

/* ─── NO-CREW HUB ─── */

export function buildNoCrewEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(DARK)
    .setTitle('🏴 CREW SYSTEM — LOS SANTOS UNDERGROUND')
    .setDescription(
      `> *"No crew. No protection. No respect."*\n\n` +
      `${DIVIDER}\n\n` +
      `You are currently **operating solo**. Join or create a crew to unlock:\n\n` +
      `> 💰 Shared crew bank & passive income\n` +
      `> 🏴 Territory control across Los Santos\n` +
      `> ⚔️ Crew wars & faction reputation\n` +
      `> 📦 Exclusive upgrades & crew bonuses\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: 'GTA Heist RPG • Crew Recruitment Terminal' })
    .setTimestamp();
}

/* ─── MAIN CREW HUB ─── */

export function buildHubEmbed(crew: Crew, members: Player[], territories: Territory[]): EmbedBuilder {
  const repNext = (Math.floor(crew.reputation / 1000) + 1) * 1000;
  const repProgress = Math.round((crew.reputation % 1000) / 1000 * 10);
  const repBar = '█'.repeat(repProgress) + '░'.repeat(10 - repProgress);
  const income = territories.reduce((s, t) => s + t.income_per_hour, 0);

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`🏴  [${crew.tag}] ${crew.name.toUpperCase()}`)
    .setDescription(
      `> ${crew.description ?? '*No description set.*'}\n\n` +
      `${DIVIDER}`
    )
    .addFields(
      {
        name: '⚡ STATUS',
        value:
          `\`\`\`\n` +
          `Level     : ${crew.level}\n` +
          `Rep       : ${crew.reputation.toLocaleString()} / ${repNext.toLocaleString()}\n` +
          `Progress  : [${repBar}]\n` +
          `\`\`\``,
        inline: false,
      },
      {
        name: '💰 FINANCES',
        value:
          `> Bank Balance  **${formatCoins(crew.bank_balance)}**\n` +
          `> Total Earned  **${formatCoins(crew.total_earnings)}**\n` +
          `> Territory Inc **${formatCoins(income)}/hr**`,
        inline: true,
      },
      {
        name: '📊 OPERATIONS',
        value:
          `> Members    **${members.length}** active\n` +
          `> Territories  **${territories.length}** controlled\n` +
          `> Heists    **${crew.total_heists}** completed`,
        inline: true,
      }
    )
    .setFooter({ text: `Crew ID: ${crew.id.slice(0, 8)} • GTA Heist RPG` })
    .setTimestamp();
}

/* ─── MEMBERS PANEL ─── */

export function buildMembersEmbed(crew: Crew, members: Player[], page: number, totalPages: number): EmbedBuilder {
  const PAGE_SIZE = 5;
  const slice = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const rows = slice.map((m, i) => {
    const icon = ROLE_ICON[m.crew_role] ?? '▪️';
    const pos = page * PAGE_SIZE + i + 1;
    return `**${pos}.** ${icon} **${m.display_name}** — LVL ${m.level} | ${m.rank} | ${formatCoins(m.total_earnings)} earned`;
  }).join('\n') || '*No members on this page.*';

  return new EmbedBuilder()
    .setColor(BLUE)
    .setTitle(`👥  [${crew.tag}] ${crew.name} — ROSTER`)
    .setDescription(`${DIVIDER}\n\n${rows}\n\n${DIVIDER}`)
    .setFooter({ text: `Page ${page + 1} / ${totalPages} • ${members.length} total members` })
    .setTimestamp();
}

/* ─── BANK PANEL ─── */

export function buildBankEmbed(crew: Crew, transactions: CrewTransaction[]): EmbedBuilder {
  const txRows = transactions.length
    ? transactions.map(t => {
        const sign = t.type === 'withdraw' ? '−' : '+';
        const color = t.type === 'withdraw' ? '🔴' : '🟢';
        const time = new Date(t.created_at).toLocaleDateString();
        return `${color} **${sign}${formatCoins(t.amount)}** — ${t.description} *(${time})*`;
      }).join('\n')
    : '*No transactions recorded yet.*';

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`💰  [${crew.tag}] ${crew.name} — CREW BANK`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `**Current Balance**\n` +
      `# ${formatCoins(crew.bank_balance)}\n\n` +
      `${DIVIDER}\n\n` +
      `**📋 Recent Transactions**\n${txRows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: 'Use deposit/withdraw to manage crew funds' })
    .setTimestamp();
}

/* ─── TERRITORIES PANEL ─── */

export function buildTerritoriesEmbed(crew: Crew, allTerritories: Territory[]): EmbedBuilder {
  const owned = allTerritories.filter(t => t.control_crew_id === crew.id);
  const totalIncome = owned.reduce((s, t) => s + t.income_per_hour, 0);

  const rows = allTerritories.map(t => {
    const isOwned = t.control_crew_id === crew.id;
    const ownerTag = t.control_crew_id
      ? (isOwned ? `[${crew.tag}] YOU` : `Enemy`)
      : `Unclaimed`;
    const status = isOwned ? '🟢' : t.control_crew_id ? '🔴' : '⚪';
    const risk = RISK_ICON[t.risk_level];
    return `${status} **${t.name}** ${risk} — ${formatCoins(t.income_per_hour)}/hr — *${ownerTag}*`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(owned.length > 0 ? GREEN : RED)
    .setTitle(`🏴  [${crew.tag}] ${crew.name} — TERRITORY CONTROL`)
    .setDescription(
      `${DIVIDER}\n\n${rows}\n\n${DIVIDER}\n\n` +
      `> Zones controlled: **${owned.length} / ${allTerritories.length}**\n` +
      `> Passive income: **${formatCoins(totalIncome)}/hr**`
    )
    .setFooter({ text: '🟢 Owned  🔴 Enemy  ⚪ Unclaimed  |  Risk: 🟢 Low  🟡 Medium  🔴 High' })
    .setTimestamp();
}

/* ─── WARS PANEL ─── */

export function buildWarsEmbed(crew: Crew, active: CrewWar[], history: CrewWar[]): EmbedBuilder {
  const activeRows = active.length
    ? active.map(w => {
        const isAttacker = w.attacker_crew_id === crew.id;
        const statusLabel = w.status === 'pending' ? '⏳ PENDING' : '⚔️ ACTIVE';
        const side = isAttacker ? 'ATTACKING' : 'DEFENDING';
        return `${statusLabel} | ${side} | Score: **${w.attacker_score}** vs **${w.defender_score}**`;
      }).join('\n')
    : '*No active wars.*';

  const historyRows = history.length
    ? history.map(w => {
        const won = w.winner_crew_id === crew.id;
        const icon = won ? '🏆' : '💀';
        return `${icon} **${won ? 'VICTORY' : 'DEFEAT'}** — ${w.attacker_score} vs ${w.defender_score}`;
      }).join('\n')
    : '*No war history.*';

  return new EmbedBuilder()
    .setColor(RED)
    .setTitle(`⚔️  [${crew.tag}] ${crew.name} — CREW WARS`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `**🔥 Active Wars**\n${activeRows}\n\n` +
      `${DIVIDER}\n\n` +
      `**📜 Recent History**\n${historyRows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: 'Declare war to challenge rival crews for territory & reputation' })
    .setTimestamp();
}

/* ─── UPGRADES PANEL ─── */

export function buildUpgradesEmbed(crew: Crew): EmbedBuilder {
  const purchased = CrewUpgradeDB.getAll(crew.id).map(u => u.upgrade_key);

  const rows = Object.values(CREW_UPGRADES).map(u => {
    const owned = purchased.includes(u.key);
    const canAfford = crew.bank_balance >= u.cost;
    const reqMet = !u.requires || purchased.includes(u.requires);
    let status = owned ? '✅' : (!reqMet ? '🔒' : (canAfford ? '🛒' : '💸'));
    return `${status} ${u.icon} **${u.name}** — ${formatCoins(u.cost)}\n　　*${u.description}*${u.requires && !owned ? ` *(Requires: ${CREW_UPGRADES[u.requires as keyof typeof CREW_UPGRADES]?.name ?? u.requires})*` : ''}`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle(`📦  [${crew.tag}] ${crew.name} — CREW UPGRADES`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `**Bank Balance:** ${formatCoins(crew.bank_balance)}\n\n` +
      `${rows}\n\n` +
      `${DIVIDER}`
    )
    .setFooter({ text: '✅ Owned  🛒 Available  💸 Insufficient funds  🔒 Locked' })
    .setTimestamp();
}

/* ─── STATS PANEL ─── */

export function buildStatsEmbed(crew: Crew, members: Player[], globalRank: number): EmbedBuilder {
  const successRate = crew.total_heists > 0
    ? Math.round((crew.total_heists / crew.total_heists) * 100)
    : 0;
  const richest = members.sort((a, b) => b.coins - a.coins)[0];
  const mostActive = members.sort((a, b) => b.total_heists - a.total_heists)[0];
  const territories = TerritoryDB.getControlledBy(crew.id);

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`📊  [${crew.tag}] ${crew.name} — CRIMINAL ANALYTICS`)
    .setDescription(`${DIVIDER}`)
    .addFields(
      {
        name: '🌍 GLOBAL STANDING',
        value:
          `> Crew Rank   **#${globalRank}** globally\n` +
          `> Level      **${crew.level}**\n` +
          `> Reputation **${crew.reputation.toLocaleString()} REP**`,
        inline: false,
      },
      {
        name: '💰 FINANCIAL RECORD',
        value:
          `> Total Earnings  **${formatCoins(crew.total_earnings)}**\n` +
          `> Bank Balance    **${formatCoins(crew.bank_balance)}**\n` +
          `> Territories     **${territories.length}** zones`,
        inline: true,
      },
      {
        name: '⚡ OPERATIONS',
        value:
          `> Heists Run  **${crew.total_heists}**\n` +
          `> Crew Size   **${members.length}** members\n` +
          `> Founded     **${new Date(crew.created_at).toLocaleDateString()}**`,
        inline: true,
      },
      {
        name: '🏆 CREW LEGENDS',
        value:
          `> Richest Member   **${richest?.display_name ?? 'N/A'}** (${formatCoins(richest?.coins ?? 0)})\n` +
          `> Most Active      **${mostActive?.display_name ?? 'N/A'}** (${mostActive?.total_heists ?? 0} heists)`,
        inline: false,
      }
    )
    .setFooter({ text: 'GTA Heist RPG • Crew Intelligence Report' })
    .setTimestamp();
}

/* ─── MANAGEMENT PANEL ─── */

export function buildManagementEmbed(crew: Crew, isOwner: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(isOwner ? GOLD : BLUE)
    .setTitle(`⚙️  [${crew.tag}] ${crew.name} — MANAGEMENT`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `**Crew Settings & Administration**\n\n` +
      (isOwner
        ? `> 📝 Edit crew name, tag and description\n> 📨 Invite new members directly\n> 👑 Transfer crew ownership\n> ⚠️ Disband the crew permanently`
        : `> ⚠️ You are not the owner\n> You may leave the crew from this panel`) +
      `\n\n${DIVIDER}`
    )
    .addFields(
      { name: 'Name', value: crew.name, inline: true },
      { name: 'Tag', value: `[${crew.tag}]`, inline: true },
      { name: 'Members', value: `${crew.member_count}`, inline: true },
      { name: 'Description', value: crew.description ?? '*Not set*', inline: false },
    )
    .setFooter({ text: 'Dangerous actions require confirmation' })
    .setTimestamp();
}

/* ─── BROWSE CREWS ─── */

export function buildBrowseEmbed(crews: Crew[]): EmbedBuilder {
  const rows = crews.length
    ? crews.slice(0, 10).map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        return `${medal} **[${c.tag}] ${c.name}** — LVL ${c.level} | ${c.member_count} members | ${formatCoins(c.total_earnings)}`;
      }).join('\n')
    : '*No crews exist yet. Be the first to create one.*';

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('🔍  LOS SANTOS CREW DIRECTORY')
    .setDescription(`${DIVIDER}\n\n${rows}\n\n${DIVIDER}`)
    .setFooter({ text: 'Ranked by total earnings' })
    .setTimestamp();
}
