import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import { PlayerDB, CrewDB, CrewTransactionDB, CrewWarDB, CrewUpgradeDB, TerritoryDB } from '../database/db.js';
import { CrewSystem } from '../systems/crew.js';
import { PlayerSystem } from '../systems/player.js';
import { logger } from '../utils/logger.js';
import { CREW_UPGRADES } from '../crew-ui/upgrades-config.js';
import { formatCoins } from '../utils/helpers.js';

import { showCrewHub, showBrowse } from '../crew-panels/hub.js';
import { showMembersPanel, showMemberActions } from '../crew-panels/members.js';
import { showBankPanel } from '../crew-panels/bank.js';
import { showTerritoriesPanel } from '../crew-panels/territories.js';
import { showWarsPanel } from '../crew-panels/wars.js';
import { showUpgradesPanel } from '../crew-panels/upgrades.js';
import { showStatsPanel } from '../crew-panels/stats.js';
import { showManagementPanel, showDisbandConfirm, showLeaveConfirm } from '../crew-panels/management.js';
import { buildHubRows, buildNoCrewRows } from '../crew-ui/buttons.js';
import { buildHubEmbed, buildNoCrewEmbed } from '../crew-ui/embeds.js';

/* ════════════════════════════════════════════════════════════
   BUTTON ROUTER
   ════════════════════════════════════════════════════════════ */

export async function routeCrewButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('crew:')) return false;

  const parts = id.split(':');
  const action = parts[1];
  const param = parts[2];

  try {
    switch (action) {
      /* ─── NAVIGATION ─── */
      case 'hub':
        await showCrewHub(interaction);
        break;

      case 'browse':
        await showBrowse(interaction);
        break;

      case 'members':
        await showMembersPanel(interaction, parseInt(param ?? '0', 10));
        break;

      case 'bank':
        await showBankPanel(interaction);
        break;

      case 'territories':
        await showTerritoriesPanel(interaction);
        break;

      case 'wars':
        await showWarsPanel(interaction);
        break;

      case 'upgrades':
        await showUpgradesPanel(interaction);
        break;

      case 'stats':
        await showStatsPanel(interaction);
        break;

      case 'management':
        await showManagementPanel(interaction);
        break;

      /* ─── MODALS ─── */
      case 'create_modal':
        await interaction.showModal(buildCreateCrewModal());
        break;

      case 'bank_deposit_modal':
        await interaction.showModal(buildDepositModal());
        break;

      case 'bank_withdraw_modal': {
        const player = PlayerDB.findByDiscordId(interaction.user.id);
        if (player?.crew_role !== 'owner') {
          await interaction.reply({ content: '❌ Only the crew owner can withdraw funds.', ephemeral: true });
        } else {
          await interaction.showModal(buildWithdrawModal());
        }
        break;
      }

      case 'mgmt_edit_modal': {
        const player = PlayerDB.findByDiscordId(interaction.user.id);
        if (player?.crew_role !== 'owner') {
          await interaction.reply({ content: '❌ Only the crew owner can edit crew details.', ephemeral: true });
        } else {
          const crew = player?.crew_id ? CrewDB.findById(player.crew_id) : null;
          await interaction.showModal(buildEditCrewModal(crew?.name ?? '', crew?.tag ?? '', crew?.description ?? ''));
        }
        break;
      }

      case 'mgmt_invite_modal': {
        const player = PlayerDB.findByDiscordId(interaction.user.id);
        if (!player?.crew_id || player.crew_role !== 'owner') {
          await interaction.reply({ content: '❌ Only the crew owner can invite players.', ephemeral: true });
        } else {
          await interaction.showModal(buildInviteModal());
        }
        break;
      }

      /* ─── MANAGEMENT ACTIONS ─── */
      case 'mgmt_disband':
        await showDisbandConfirm(interaction);
        break;

      case 'mgmt_disband_confirm':
        await handleDisbandConfirm(interaction);
        break;

      case 'leave':
        await showLeaveConfirm(interaction);
        break;

      case 'leave_confirm':
        await handleLeaveConfirm(interaction);
        break;

      /* ─── MEMBER ACTIONS ─── */
      case 'kick':
        await handleKick(interaction, param);
        break;

      case 'promote':
        await handlePromote(interaction, param);
        break;

      case 'transfer':
        await handleTransfer(interaction, param);
        break;

      /* ─── UPGRADE PURCHASE ─── */
      case 'upgrade_buy':
        await handleUpgradePurchase(interaction, param);
        break;

      /* ─── WAR ACCEPT ─── */
      case 'war_accept':
        await handleWarAccept(interaction, param);
        break;

      default:
        return false;
    }
  } catch (err) {
    logger.error(`Crew button error [${action}]:`, err);
    const msg = err instanceof Error ? err.message : 'An error occurred.';
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${msg}`, ephemeral: true }).catch(() => null);
    }
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   SELECT MENU ROUTER
   ════════════════════════════════════════════════════════════ */

export async function routeCrewSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('crew_select:')) return false;

  const action = id.split(':')[1];

  try {
    switch (action) {
      case 'member_action':
        await showMemberActions(interaction, interaction.values[0]);
        break;

      case 'territory_attack':
        await handleTerritoryAttack(interaction, interaction.values[0]);
        break;

      case 'war_declare':
        await handleWarDeclare(interaction, interaction.values[0]);
        break;

      default:
        return false;
    }
  } catch (err) {
    logger.error(`Crew select error [${action}]:`, err);
    const msg = err instanceof Error ? err.message : 'An error occurred.';
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${msg}`, ephemeral: true }).catch(() => null);
    }
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   MODAL ROUTER
   ════════════════════════════════════════════════════════════ */

export async function routeCrewModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const id = interaction.customId;
  if (!id.startsWith('crew_modal:')) return false;

  const action = id.split(':')[1];

  try {
    switch (action) {
      case 'create':
        await handleCreateCrew(interaction);
        break;

      case 'bank_deposit':
        await handleBankDeposit(interaction);
        break;

      case 'bank_withdraw':
        await handleBankWithdraw(interaction);
        break;

      case 'edit':
        await handleEditCrew(interaction);
        break;

      case 'invite':
        await handleInvitePlayer(interaction);
        break;

      default:
        return false;
    }
  } catch (err) {
    logger.error(`Crew modal error [${action}]:`, err);
    const msg = err instanceof Error ? err.message : 'An error occurred.';
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${msg}`, ephemeral: true }).catch(() => null);
    }
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   MODAL BUILDERS
   ════════════════════════════════════════════════════════════ */

function buildCreateCrewModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('crew_modal:create')
    .setTitle('🏴 Create New Crew')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Crew Name')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(32)
          .setPlaceholder('e.g. Los Santos Cartel')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tag')
          .setLabel('Crew Tag (2–5 characters)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(5)
          .setPlaceholder('e.g. LSC')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(100)
          .setRequired(false)
          .setPlaceholder('What is your crew about?')
      ),
    );
}

function buildDepositModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('crew_modal:bank_deposit')
    .setTitle('💰 Deposit to Crew Bank')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Amount to deposit ($)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(10)
          .setPlaceholder('e.g. 5000')
          .setRequired(true)
      ),
    );
}

function buildWithdrawModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('crew_modal:bank_withdraw')
    .setTitle('📤 Withdraw from Crew Bank')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Amount to withdraw ($)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(10)
          .setPlaceholder('e.g. 5000')
          .setRequired(true)
      ),
    );
}

function buildEditCrewModal(currentName: string, currentTag: string, currentDesc: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('crew_modal:edit')
    .setTitle('📝 Edit Crew Details')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('New Description')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(100)
          .setValue(currentDesc)
          .setRequired(false)
      ),
    );
}

function buildInviteModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('crew_modal:invite')
    .setTitle('📨 Invite Player to Crew')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('Player Discord ID')
          .setStyle(TextInputStyle.Short)
          .setMinLength(10)
          .setMaxLength(20)
          .setPlaceholder('e.g. 123456789012345678')
          .setRequired(true)
      ),
    );
}

/* ════════════════════════════════════════════════════════════
   ACTION HANDLERS
   ════════════════════════════════════════════════════════════ */

async function handleCreateCrew(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue('name').trim();
  const tag = interaction.fields.getTextInputValue('tag').trim().toUpperCase();
  const description = interaction.fields.getTextInputValue('description').trim() || undefined;

  PlayerSystem.getOrCreate(
    interaction.user.id,
    interaction.user.displayName,
    interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  try {
    const crew = CrewSystem.create(name, tag, interaction.user.id, description);
    const player = PlayerDB.findByDiscordId(interaction.user.id)!;
    const members = CrewDB.getMembers(crew.id);
    const territories = TerritoryDB.getControlledBy(crew.id);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00D26A)
          .setTitle(`✅ Crew Created — [${crew.tag}] ${crew.name}`)
          .setDescription(`Your crew is operational. Use \`/crew\` to open the full crew hub.`)
          .setTimestamp(),
      ],
      components: [],
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ ${err instanceof Error ? err.message : 'Failed to create crew.'}` });
  }
}

async function handleBankDeposit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const raw = interaction.fields.getTextInputValue('amount').replace(/[^0-9]/g, '');
  const amount = parseInt(raw, 10);

  if (isNaN(amount) || amount <= 0) {
    await interaction.editReply({ content: '❌ Invalid amount. Enter a positive number.' });
    return;
  }

  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.editReply({ content: '❌ You are not in a crew.' });
    return;
  }

  if (player.coins < amount) {
    await interaction.editReply({ content: `❌ Insufficient funds. You only have ${formatCoins(player.coins)}.` });
    return;
  }

  PlayerDB.addCoins(interaction.user.id, -amount);
  CrewDB.depositToBank(player.crew_id, amount);
  CrewTransactionDB.record(player.crew_id, 'deposit', amount, `Deposit by ${interaction.user.displayName}`, interaction.user.id);

  const crew = CrewDB.findById(player.crew_id)!;
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle('💰 Deposit Successful')
        .setDescription(
          `> Deposited: **${formatCoins(amount)}**\n` +
          `> New Bank Balance: **${formatCoins(crew.bank_balance)}**`
        )
        .setTimestamp(),
    ],
  });
}

async function handleBankWithdraw(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const raw = interaction.fields.getTextInputValue('amount').replace(/[^0-9]/g, '');
  const amount = parseInt(raw, 10);

  if (isNaN(amount) || amount <= 0) {
    await interaction.editReply({ content: '❌ Invalid amount.' });
    return;
  }

  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.editReply({ content: '❌ Only the crew owner can withdraw funds.' });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew || crew.bank_balance < amount) {
    await interaction.editReply({ content: `❌ Insufficient bank balance. Current: ${formatCoins(crew?.bank_balance ?? 0)}` });
    return;
  }

  CrewDB.withdrawFromBank(player.crew_id, amount);
  PlayerDB.addCoins(interaction.user.id, amount);
  CrewTransactionDB.record(player.crew_id, 'withdraw', amount, `Withdrawal by ${interaction.user.displayName}`, interaction.user.id);

  const updated = CrewDB.findById(player.crew_id)!;
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFFA502)
        .setTitle('📤 Withdrawal Successful')
        .setDescription(
          `> Withdrawn: **${formatCoins(amount)}**\n` +
          `> New Bank Balance: **${formatCoins(updated.bank_balance)}**`
        )
        .setTimestamp(),
    ],
  });
}

async function handleEditCrew(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.editReply({ content: '❌ Only the crew owner can edit the crew.' });
    return;
  }

  const description = interaction.fields.getTextInputValue('description').trim() || null;
  CrewDB.update(player.crew_id, { description });

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle('✅ Crew Updated')
        .setDescription('Crew description has been updated successfully.')
        .setTimestamp(),
    ],
  });
}

async function handleInvitePlayer(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.fields.getTextInputValue('user_id').trim();

  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.editReply({ content: '❌ Only the crew owner can invite players.' });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    await interaction.editReply({ content: '❌ Crew not found.' });
    return;
  }

  const target = PlayerDB.findByDiscordId(userId);
  if (!target) {
    await interaction.editReply({ content: `❌ Player with ID **${userId}** has not used the bot yet. They must run \`/profile\` first.` });
    return;
  }

  if (target.crew_id) {
    await interaction.editReply({ content: `❌ **${target.display_name}** is already in a crew.` });
    return;
  }

  try {
    CrewSystem.join(crew.id, userId);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00D26A)
          .setTitle('✅ Player Invited')
          .setDescription(`**${target.display_name}** has been added to **[${crew.tag}] ${crew.name}**.`)
          .setTimestamp(),
      ],
    });
  } catch (err) {
    await interaction.editReply({ content: `❌ ${err instanceof Error ? err.message : 'Could not invite player.'}` });
  }
}

async function handleDisbandConfirm(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can disband the crew.', embeds: [], components: [] });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    await interaction.update({ content: '❌ Crew not found.', embeds: [], components: [] });
    return;
  }

  CrewDB.disband(crew.id);
  logger.game(`Crew disbanded: ${crew.name} by ${interaction.user.id}`);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xE94560)
        .setTitle('💥 Crew Disbanded')
        .setDescription(`**[${crew.tag}] ${crew.name}** has been permanently disbanded.`)
        .setTimestamp(),
    ],
    components: buildNoCrewRows(),
  });
}

async function handleLeaveConfirm(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  if (player.crew_role === 'owner') {
    await interaction.update({ content: '❌ Transfer ownership or disband the crew before leaving.', embeds: [], components: [] });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  CrewSystem.leave(interaction.user.id);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFFA502)
        .setTitle('🚪 Left Crew')
        .setDescription(`You have left **[${crew?.tag ?? '?'}] ${crew?.name ?? 'the crew'}**. Stay out of trouble.`)
        .setTimestamp(),
    ],
    components: buildNoCrewRows(),
  });
}

async function handleKick(interaction: ButtonInteraction, targetId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can kick members.', embeds: [], components: [] });
    return;
  }

  const target = PlayerDB.findByDiscordId(targetId);
  if (!target || target.crew_id !== player.crew_id) {
    await interaction.update({ content: '❌ Member not found in your crew.', embeds: [], components: [] });
    return;
  }

  if (target.crew_role === 'owner') {
    await interaction.update({ content: '❌ Cannot kick the crew owner.', embeds: [], components: [] });
    return;
  }

  CrewDB.removeMember(player.crew_id, targetId);
  logger.game(`${targetId} was kicked from crew ${player.crew_id} by ${interaction.user.id}`);

  await showMembersPanel(interaction, 0);
}

async function handlePromote(interaction: ButtonInteraction, targetId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can manage roles.', embeds: [], components: [] });
    return;
  }

  const target = PlayerDB.findByDiscordId(targetId);
  if (!target || target.crew_id !== player.crew_id) {
    await interaction.update({ content: '❌ Member not found in your crew.', embeds: [], components: [] });
    return;
  }

  const newRole = target.crew_role === 'officer' ? 'member' : 'officer';
  PlayerDB.update(targetId, { crew_role: newRole });

  await showMembersPanel(interaction, 0);
}

async function handleTransfer(interaction: ButtonInteraction, targetId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can transfer ownership.', embeds: [], components: [] });
    return;
  }

  const target = PlayerDB.findByDiscordId(targetId);
  if (!target || target.crew_id !== player.crew_id) {
    await interaction.update({ content: '❌ Member not found in your crew.', embeds: [], components: [] });
    return;
  }

  PlayerDB.update(targetId, { crew_role: 'owner' });
  PlayerDB.update(interaction.user.id, { crew_role: 'officer' });
  CrewDB.update(player.crew_id, { owner_id: targetId });

  logger.game(`Ownership of crew ${player.crew_id} transferred from ${interaction.user.id} to ${targetId}`);

  await showMembersPanel(interaction, 0);
}

async function handleTerritoryAttack(interaction: StringSelectMenuInteraction, territoryId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  const territory = TerritoryDB.findById(territoryId);
  if (!territory) {
    await interaction.update({ content: '❌ Territory not found.', embeds: [], components: [] });
    return;
  }

  if (territory.control_crew_id === player.crew_id) {
    await interaction.update({ content: '❌ You already control this territory.', embeds: [], components: [] });
    return;
  }

  CrewSystem.captureTerritory(player.crew_id, territoryId);
  logger.game(`Crew ${player.crew_id} captured territory: ${territory.name}`);

  const crew = CrewDB.findById(player.crew_id)!;
  const allTerritories = TerritoryDB.getAll();

  const { buildTerritoriesEmbed } = await import('../crew-ui/embeds.js');
  const { buildTerritoriesRows } = await import('../crew-ui/buttons.js');

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00D26A)
        .setTitle(`🏴 Territory Captured — ${territory.name}`)
        .setDescription(
          `**[${crew.tag}] ${crew.name}** now controls **${territory.name}**.\n\n` +
          `> Income: **+${formatCoins(territory.income_per_hour)}/hr**\n` +
          `> Rep Bonus: **+50 REP**`
        )
        .setTimestamp(),
    ],
    components: buildTerritoriesRows(allTerritories, crew.id),
  });
}

async function handleWarDeclare(interaction: StringSelectMenuInteraction, defenderCrewId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  if (!['owner', 'officer'].includes(player.crew_role)) {
    await interaction.update({ content: '❌ Only owners and officers can declare war.', embeds: [], components: [] });
    return;
  }

  if (CrewWarDB.hasPendingWarBetween(player.crew_id, defenderCrewId)) {
    await interaction.update({ content: '❌ A war already exists between these crews.', embeds: [], components: [] });
    return;
  }

  const attacker = CrewDB.findById(player.crew_id)!;
  const defender = CrewDB.findById(defenderCrewId);
  if (!defender) {
    await interaction.update({ content: '❌ Target crew not found.', embeds: [], components: [] });
    return;
  }

  const war = CrewWarDB.declare(player.crew_id, defenderCrewId);

  const active = CrewWarDB.getActiveForCrew(player.crew_id);
  const history = CrewWarDB.getHistoryForCrew(player.crew_id, 5);
  const allCrews = CrewDB.getAllCrews();
  const { buildWarsEmbed } = await import('../crew-ui/embeds.js');
  const { buildWarsRows } = await import('../crew-ui/buttons.js');

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xE94560)
        .setTitle('⚔️ War Declared!')
        .setDescription(
          `**[${attacker.tag}] ${attacker.name}** has declared war on **[${defender.tag}] ${defender.name}**!\n\n` +
          `The war is pending — waiting for **[${defender.tag}] ${defender.name}** to accept the challenge.\n\n` +
          `> War ID: \`${war.id.slice(0, 8)}\``
        )
        .setTimestamp(),
    ],
    components: buildWarsRows(allCrews, player.crew_id, active),
  });
}

async function handleWarAccept(interaction: ButtonInteraction, warId: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id) {
    await interaction.update({ content: '❌ You are not in a crew.', embeds: [], components: [] });
    return;
  }

  const war = CrewWarDB.findById(warId);
  if (!war || war.defender_crew_id !== player.crew_id) {
    await interaction.update({ content: '❌ War not found or you are not the target crew.', embeds: [], components: [] });
    return;
  }

  if (!['owner', 'officer'].includes(player.crew_role)) {
    await interaction.update({ content: '❌ Only owners and officers can accept wars.', embeds: [], components: [] });
    return;
  }

  CrewWarDB.accept(warId);

  const attacker = CrewDB.findById(war.attacker_crew_id)!;
  const defender = CrewDB.findById(war.defender_crew_id)!;
  const active = CrewWarDB.getActiveForCrew(player.crew_id);
  const history = CrewWarDB.getHistoryForCrew(player.crew_id, 5);
  const allCrews = CrewDB.getAllCrews();
  const { buildWarsEmbed } = await import('../crew-ui/embeds.js');
  const { buildWarsRows } = await import('../crew-ui/buttons.js');

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xE94560)
        .setTitle('⚔️ War Accepted — HOSTILITIES ACTIVE')
        .setDescription(
          `**[${attacker.tag}] ${attacker.name}** vs **[${defender.tag}] ${defender.name}**\n\n` +
          `The war is now **active**. Heists completed by crew members will add to the war score.\n\n` +
          `> Starting Score: **0 — 0**`
        )
        .setTimestamp(),
    ],
    components: buildWarsRows(allCrews, player.crew_id, active),
  });
}

async function handleUpgradePurchase(interaction: ButtonInteraction, upgradeKey: string): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  if (!player?.crew_id || player.crew_role !== 'owner') {
    await interaction.update({ content: '❌ Only the crew owner can purchase upgrades.', embeds: [], components: [] });
    return;
  }

  const upgrade = CREW_UPGRADES[upgradeKey as keyof typeof CREW_UPGRADES];
  if (!upgrade) {
    await interaction.update({ content: '❌ Invalid upgrade.', embeds: [], components: [] });
    return;
  }

  if (CrewUpgradeDB.has(player.crew_id, upgradeKey)) {
    await interaction.update({ content: '❌ You already own this upgrade.', embeds: [], components: [] });
    return;
  }

  if (upgrade.requires && !CrewUpgradeDB.has(player.crew_id, upgrade.requires)) {
    const req = CREW_UPGRADES[upgrade.requires as keyof typeof CREW_UPGRADES];
    await interaction.update({ content: `❌ Requires **${req?.name ?? upgrade.requires}** first.`, embeds: [], components: [] });
    return;
  }

  const crew = CrewDB.findById(player.crew_id)!;
  if (crew.bank_balance < upgrade.cost) {
    await interaction.update({ content: `❌ Insufficient crew bank funds. Need ${formatCoins(upgrade.cost)}, have ${formatCoins(crew.bank_balance)}.`, embeds: [], components: [] });
    return;
  }

  CrewDB.withdrawFromBank(player.crew_id, upgrade.cost);
  CrewUpgradeDB.purchase(player.crew_id, upgradeKey);
  CrewTransactionDB.record(player.crew_id, 'upgrade_purchase', upgrade.cost, `Upgrade: ${upgrade.name}`, interaction.user.id);

  const updated = CrewDB.findById(player.crew_id)!;
  const { buildUpgradesEmbed } = await import('../crew-ui/embeds.js');
  const { buildUpgradesRows } = await import('../crew-ui/buttons.js');

  await interaction.update({
    embeds: [buildUpgradesEmbed(updated)],
    components: buildUpgradesRows(updated),
  });
}
