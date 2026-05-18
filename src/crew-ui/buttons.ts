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
import { t } from '../utils/i18n.js';

/* ─── BACK TO HUB ─── */

export function buildBackRow(lang = 'en'): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.back_to_hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
}

/* ─── NO-CREW BUTTONS ─── */

export function buildNoCrewRows(lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:create_modal').setLabel(t(lang, 'crew.buttons.create')).setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId('crew:browse').setLabel(t(lang, 'crew.buttons.browse')).setStyle(ButtonStyle.Primary).setEmoji('🔍'),
    ),
  ];
}

/* ─── MAIN HUB NAVIGATION ─── */

export function buildHubRows(isOwnerOrOfficer: boolean, lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:members:0').setLabel(t(lang, 'crew.buttons.members')).setStyle(ButtonStyle.Primary).setEmoji('👥'),
    new ButtonBuilder().setCustomId('crew:bank').setLabel(t(lang, 'crew.buttons.crew_bank')).setStyle(ButtonStyle.Primary).setEmoji('💰'),
    new ButtonBuilder().setCustomId('crew:territories').setLabel(t(lang, 'crew.buttons.territories')).setStyle(ButtonStyle.Primary).setEmoji('🏴'),
    new ButtonBuilder().setCustomId('crew:wars').setLabel(t(lang, 'crew.buttons.crew_wars')).setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId('crew:upgrades').setLabel(t(lang, 'crew.buttons.upgrades')).setStyle(ButtonStyle.Primary).setEmoji('📦'),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:stats').setLabel(t(lang, 'crew.buttons.statistics')).setStyle(ButtonStyle.Secondary).setEmoji('📊'),
    new ButtonBuilder().setCustomId('crew:management').setLabel(t(lang, 'crew.buttons.management')).setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
  );
  return [row1, row2];
}

/* ─── MEMBERS PANEL ─── */

export function buildMembersRows(
  page: number,
  totalPages: number,
  isOwner: boolean,
  members: Player[],
  lang = 'en',
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`crew:members:${page - 1}`)
      .setLabel(t(lang, 'crew.buttons.prev'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`crew:members:${page + 1}`)
      .setLabel(t(lang, 'crew.buttons.next'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
    new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
  rows.push(navRow);

  if (isOwner && members.length > 1) {
    const nonOwners = members.filter(m => m.crew_role !== 'owner').slice(0, 25);
    if (nonOwners.length > 0) {
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('crew_select:member_action')
          .setPlaceholder(t(lang, 'crew.buttons.member_manage_ph'))
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

/* ─── MEMBER ACTION ROW ─── */

export function buildMemberActionRows(targetId: string, isOfficer: boolean, lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:promote:${targetId}`)
        .setLabel(isOfficer ? t(lang, 'crew.buttons.demote_member') : t(lang, 'crew.buttons.promote_officer'))
        .setStyle(isOfficer ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setEmoji(isOfficer ? '▪️' : '⭐'),
      new ButtonBuilder()
        .setCustomId(`crew:kick:${targetId}`)
        .setLabel(t(lang, 'crew.buttons.kick'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚫'),
      new ButtonBuilder()
        .setCustomId(`crew:transfer:${targetId}`)
        .setLabel(t(lang, 'crew.buttons.transfer'))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👑'),
      new ButtonBuilder()
        .setCustomId('crew:members:0')
        .setLabel(t(lang, 'crew.buttons.back'))
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* ─── BANK PANEL ─── */

export function buildBankRows(isOwner: boolean, lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('crew:bank_deposit_modal').setLabel(t(lang, 'crew.buttons.deposit')).setStyle(ButtonStyle.Success).setEmoji('📥'),
    new ButtonBuilder().setCustomId('crew:bank_withdraw_modal').setLabel(t(lang, 'crew.buttons.withdraw')).setStyle(ButtonStyle.Danger).setEmoji('📤').setDisabled(!isOwner),
    new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );
  return [row];
}

/* ─── TERRITORIES PANEL ─── */

export function buildTerritoriesRows(
  allTerritories: Territory[],
  crewId: string,
  lang = 'en',
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const unclaimed = allTerritories.filter(t2 => !t2.control_crew_id);
  const enemy = allTerritories.filter(t2 => t2.control_crew_id && t2.control_crew_id !== crewId);
  const attackable = [...unclaimed, ...enemy].slice(0, 25);

  if (attackable.length > 0) {
    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('crew_select:territory_attack')
        .setPlaceholder(t(lang, 'crew.buttons.territory_attack_ph'))
        .addOptions(
          attackable.map(t2 =>
            new StringSelectMenuOptionBuilder()
              .setLabel(t2.name)
              .setDescription(`${t2.income_per_hour}/hr | Risk: ${t2.risk_level} | ${t2.control_crew_id ? 'Enemy-held' : 'Unclaimed'}`)
              .setValue(t2.id)
              .setEmoji(t2.control_crew_id ? '🔴' : '⚪')
          )
        )
    );
    rows.push(selectRow);
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    )
  );

  return rows;
}

/* ─── WARS PANEL ─── */

export function buildWarsRows(
  allCrews: Crew[],
  crewId: string,
  activeWars: CrewWar[],
  lang = 'en',
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<any>[] = [];

  const pendingForUs = activeWars.filter(w => w.defender_crew_id === crewId && w.status === 'pending');

  const enemies = allCrews.filter(c => c.id !== crewId).slice(0, 25);
  if (enemies.length > 0) {
    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('crew_select:war_declare')
        .setPlaceholder(t(lang, 'crew.buttons.war_declare_ph'))
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
    new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
  );

  if (pendingForUs.length > 0) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:war_accept:${pendingForUs[0].id}`)
        .setLabel(t(lang, 'crew.buttons.accept_war'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚔️'),
    );
  }

  rows.push(btnRow);
  return rows;
}

/* ─── UPGRADES PANEL ─── */

export function buildUpgradesRows(crew: Crew, lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
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
      new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    )
  );

  return rows;
}

/* ─── STATS PANEL ─── */

export function buildStatsRows(lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    ),
  ];
}

/* ─── MANAGEMENT PANEL ─── */

export function buildManagementRows(isOwner: boolean, lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  if (!isOwner) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('crew:leave').setLabel(t(lang, 'crew.buttons.leave')).setStyle(ButtonStyle.Danger).setEmoji('🚪'),
        new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:mgmt_edit_modal').setLabel(t(lang, 'crew.buttons.edit_details')).setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId('crew:mgmt_invite_modal').setLabel(t(lang, 'crew.buttons.invite_player')).setStyle(ButtonStyle.Success).setEmoji('📨'),
      new ButtonBuilder().setCustomId('crew:hub').setLabel(t(lang, 'crew.buttons.hub')).setStyle(ButtonStyle.Secondary).setEmoji('🏠'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('crew:mgmt_disband').setLabel(t(lang, 'crew.buttons.disband')).setStyle(ButtonStyle.Danger).setEmoji('💥'),
      new ButtonBuilder().setCustomId('crew:leave').setLabel(t(lang, 'crew.buttons.leave')).setStyle(ButtonStyle.Danger).setEmoji('🚪').setDisabled(true),
    ),
  ];
}

/* ─── CONFIRM / CANCEL ─── */

export function buildConfirmCancelRows(confirmId: string, label = 'Confirm', lang = 'en'): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel(label).setStyle(ButtonStyle.Danger).setEmoji('✅'),
      new ButtonBuilder().setCustomId('crew:management').setLabel(t(lang, 'crew.buttons.cancel')).setStyle(ButtonStyle.Secondary).setEmoji('✖️'),
    ),
  ];
}
