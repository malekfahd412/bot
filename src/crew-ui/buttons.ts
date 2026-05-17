import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { Player, Crew, Territory, CrewWar } from '../database/schema.js';
import { CREW_UPGRADES } from './upgrades-config.js';
import { CrewUpgradeDB } from '../database/db.js';

/* ─── BACK TO HUB ─── */

export function buildBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:hub').setLabel('← Back to Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
}

/* ─── NO-CREW BUTTONS ─── */

export function buildNoCrewRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:create_modal').setLabel('Create Crew').setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId('crew:browse').setLabel('Browse Crews').setStyle(ButtonStyle.Primary).setEmoji('🔍'),
    ),
  ];
}

/* ─── MAIN HUB NAVIGATION ─── */

export function buildHubRows(isOwnerOrOfficer: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:members:0').setLabel('Members').setStyle(ButtonStyle.Primary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('crew:bank').setLabel('Crew Bank').setStyle(ButtonStyle.Primary).setEmoji('💰'),
    new ButtonBuilder().setCustomId('crew:territories').setLabel('Territories').setStyle(ButtonStyle.Primary).setEmoji('🏴'),
    new ButtonBuilder().setCustomId('crew:wars').setLabel('Crew Wars').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('crew:upgrades').setLabel('Upgrades').setStyle(ButtonStyle.Primary).setEmoji('📦'),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:stats').setLabel('Statistics').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
    new ButtonBuilder().setCustomId('crew:management').setLabel('Management').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
  );
  return [row1, row2];
}

/* ─── MEMBERS PANEL ─── */

export function buildMembersRows(
  page: number,
  totalPages: number,
  isOwner: boolean,
  members: Player[],
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`crew:members:${page - 1}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`crew:members:${page + 1}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
  rows.push(navRow);

  if (isOwner && members.length > 1) {
    const nonOwners = members.filter(m => m.crew_role !== 'owner').slice(0, 25);
    if (nonOwners.length > 0) {
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('crew_select:member_action')
          .setPlaceholder('⚙️ Select a member to manage...')
          .addOptions(
            nonOwners.map(m =>
              new StringSelectMenuOptionBuilder()
                .setLabel(m.display_name)
                .setDescription(`LVL ${m.level} | ${m.crew_role}`)
                .setValue(m.discord_id)
                .setEmoji(m.crew_role === 'officer' ? '⭐' : '▪️')
            )
          )
      );
      rows.push(selectRow);
    }
  }

  return rows;
}

/* ─── MEMBER ACTION ROW (after selecting a member) ─── */

export function buildMemberActionRows(targetId: string, isOfficer: boolean): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:promote:${targetId}`)
        .setLabel(isOfficer ? 'Demote to Member' : 'Promote to Officer')
        .setStyle(isOfficer ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setEmoji(isOfficer ? '▪️' : '⭐'),
      new ButtonBuilder()
        .setCustomId(`crew:kick:${targetId}`)
        .setLabel('Kick from Crew')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚫'),
      new ButtonBuilder()
        .setCustomId(`crew:transfer:${targetId}`)
        .setLabel('Transfer Ownership')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👑'),
      new ButtonBuilder()
        .setCustomId('crew:members:0')
        .setLabel('← Back')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* ─── BANK PANEL ─── */

export function buildBankRows(isOwner: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:bank_deposit_modal').setLabel('Deposit').setStyle(ButtonStyle.Success).setEmoji('📥'),
    new ButtonBuilder().setCustomId('crew:bank_withdraw_modal').setLabel('Withdraw').setStyle(ButtonStyle.Danger).setEmoji('📤').setDisabled(!isOwner),
    new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
  return [row];
}

/* ─── TERRITORIES PANEL ─── */

export function buildTerritoriesRows(
  allTerritories: Territory[],
  crewId: string,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const unclaimed = allTerritories.filter(t => !t.control_crew_id);
  const enemy = allTerritories.filter(t => t.control_crew_id && t.control_crew_id !== crewId);
  const attackable = [...unclaimed, ...enemy].slice(0, 25);

  if (attackable.length > 0) {
    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('crew_select:territory_attack')
        .setPlaceholder('⚔️ Select a territory to attack...')
        .addOptions(
          attackable.map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(t.name)
              .setDescription(`${t.income_per_hour}/hr | Risk: ${t.risk_level} | ${t.control_crew_id ? 'Enemy-held' : 'Unclaimed'}`)
              .setValue(t.id)
              .setEmoji(t.control_crew_id ? '🔴' : '⚪')
          )
        )
    );
    rows.push(selectRow);
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    )
  );

  return rows;
}

/* ─── WARS PANEL ─── */

export function buildWarsRows(
  allCrews: Crew[],
  crewId: string,
  activeWars: CrewWar[],
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const pendingForUs = activeWars.filter(w => w.defender_crew_id === crewId && w.status === 'pending');

  const enemies = allCrews.filter(c => c.id !== crewId).slice(0, 25);
  if (enemies.length > 0) {
    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('crew_select:war_declare')
        .setPlaceholder('⚔️ Declare war on a crew...')
        .addOptions(
          enemies.map(c =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`[${c.tag}] ${c.name}`)
              .setDescription(`LVL ${c.level} | ${c.member_count} members | ${c.total_earnings} earned`)
              .setValue(c.id)
              .setEmoji('⚔️')
          )
        )
    );
    rows.push(selectRow);
  }

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );

  if (pendingForUs.length > 0) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:war_accept:${pendingForUs[0].id}`)
        .setLabel('Accept War Challenge')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚔️'),
    );
  }

  rows.push(btnRow);
  return rows;
}

/* ─── UPGRADES PANEL ─── */

export function buildUpgradesRows(crew: Crew): ActionRowBuilder<ButtonBuilder>[] {
  const purchased = CrewUpgradeDB.getAll(crew.id).map(u => u.upgrade_key);
  const upgrades = Object.values(CREW_UPGRADES);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;

  for (const u of upgrades) {
    const owned = purchased.includes(u.key);
    const reqMet = !u.requires || purchased.includes(u.requires);
    const canAfford = crew.bank_balance >= u.cost;
    const disabled = owned || !reqMet || !canAfford;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:upgrade_buy:${u.key}`)
        .setLabel(u.name)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setEmoji(u.icon)
        .setDisabled(disabled)
    );
    count++;

    if (count % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  if (count % 5 !== 0) rows.push(row);

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    )
  );

  return rows;
}

/* ─── STATS PANEL ─── */

export function buildStatsRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    ),
  ];
}

/* ─── MANAGEMENT PANEL ─── */

export function buildManagementRows(isOwner: boolean): ActionRowBuilder<ButtonBuilder>[] {
  if (!isOwner) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('crew:leave').setLabel('Leave Crew').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
        new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:mgmt_edit_modal').setLabel('Edit Details').setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId('crew:mgmt_invite_modal').setLabel('Invite Player').setStyle(ButtonStyle.Success).setEmoji('📨'),
      new ButtonBuilder().setCustomId('crew:hub').setLabel('← Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:mgmt_disband').setLabel('Disband Crew').setStyle(ButtonStyle.Danger).setEmoji('💥'),
      new ButtonBuilder().setCustomId('crew:leave').setLabel('Leave Crew').setStyle(ButtonStyle.Danger).setEmoji('🚪').setDisabled(true),
    ),
  ];
}

/* ─── CONFIRM / CANCEL ─── */

export function buildConfirmCancelRows(confirmId: string, label = 'Confirm'): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel(label).setStyle(ButtonStyle.Danger).setEmoji('✅'),
      new ButtonBuilder().setCustomId('crew:management').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('✖️'),
    ),
  ];
}
