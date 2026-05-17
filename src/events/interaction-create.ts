import {
  Events, Interaction, ChatInputCommandInteraction,
  ModalSubmitInteraction, ButtonInteraction,
  AttachmentBuilder, Collection, PermissionFlagsBits, REST, Routes,
} from 'discord.js';

import { logger } from '../utils/logger.js';
import { ApprovalSystem } from '../systems/approval.js';
import { HeistSystem } from '../systems/heist.js';
import { getEventEngine } from '../systems/events.js';
import { handleHeistModal } from '../commands/heist-log.js';
import { handleAdminButton } from '../commands/admin.js';
import { generateMissionCard } from '../canvas/mission-card.js';
import { handleCrewSelect } from '../interactions/crewSelect.js';
import { handleCrewJoin } from '../interactions/crewJoin.js';
import type { Difficulty } from '../utils/constants.js';

export const name = Events.InteractionCreate;

type CommandModule = {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export async function execute(
  interaction: Interaction,
  commands: Collection<string, CommandModule>,
  configData: { reviewChannelId?: string }
): Promise<void> {

  /* ─── SLASH COMMANDS ─── */
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      logger.error(String(err));
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Error executing command', ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  /* ─── MODALS ─── */
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(interaction as ModalSubmitInteraction, configData.reviewChannelId);
      } catch (err) {
        logger.error(String(err));
      }
    }
    return;
  }

  /* ─── SELECT MENUS ─── */
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'crew_select') {
      try {
        await handleCrewSelect(interaction);
      } catch (err) {
        logger.error(String(err));
      }
    }
    return;
  }

  /* ─── BUTTONS ─── */
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const button = interaction as ButtonInteraction;
  const customId = button.customId;
  const [action] = customId.split(':');

  /* ─── EVENT ENGINE ─── */
  if (action === 'event_join') {
    const eventId = customId.slice('event_join:'.length);
    const engine = getEventEngine();
    if (!engine) { await button.reply({ content: '⚠️ Event engine is offline.', ephemeral: true }); return; }
    try { await engine.handleJoin(button, eventId); } catch (err) { logger.error('Event join error:', err); }
    return;
  }

  if (action === 'event_skip') {
    const engine = getEventEngine();
    try { await engine?.handleSkip(button); } catch (err) { logger.error('Event skip error:', err); }
    return;
  }

  /* ─── CREW JOIN ─── */
  if (action === 'crew_join') {
    try {
      await handleCrewJoin(button);
    } catch (err) {
      logger.error(String(err));
      await button.reply({ content: '❌ Failed to join crew', ephemeral: true }).catch(() => null);
    }
    return;
  }

  /* ─── ADMIN SYSTEM (panel, confirm, cancel) ─── */
  if (action === 'admin_panel' || action === 'admin_confirm' || action === 'admin_cancel') {
    const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    if (!isAdmin) { await button.reply({ content: '🚫 Admin only.', ephemeral: true }); return; }
    try { await handleAdminButton(button); } catch (err) { logger.error('Admin button error:', err); }
    return;
  }

  /* ─── BOT RESET ─── */
  if (customId === 'bot_reset_confirm') {
    const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    if (!isAdmin) { await button.reply({ content: '🚫 Admin only', ephemeral: true }); return; }
    await button.reply({ content: '🧹 Resetting commands...', ephemeral: true });
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: [] });
      await button.followUp({ content: '✅ Commands cleared.', ephemeral: true });
    } catch (err) { logger.error(String(err)); }
    return;
  }

  /* ─── ADMIN GUARD for heist approve/reject ─── */
  const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  if (!isAdmin) { await button.reply({ content: '🚫 Admin only', ephemeral: true }); return; }

  /* ─── HEIST APPROVE / REJECT ─── */
  const id = customId.split(':')[1];
  try {
    let response: { content: string; files: AttachmentBuilder[]; components: never[] } | undefined;

    if (action === 'heist_approve') {
      const result = await ApprovalSystem.approve(id, button.user.id);
      const buffer = await generateMissionCard(
        result.submission.heist_name,
        result.submission.difficulty as Difficulty,
        `<@${result.submission.submitter_id}>`,
        HeistSystem.getTeammates(result.submission).map(t => `<@${t}>`),
        result.xpAwarded, result.coinsAwarded, true
      );
      response = { content: `✅ Approved by <@${button.user.id}>`, files: [new AttachmentBuilder(buffer, { name: 'heist.png' })], components: [] };
    } else if (action === 'heist_reject') {
      const submission = ApprovalSystem.reject(id, button.user.id);
      const buffer = await generateMissionCard(
        submission.heist_name,
        submission.difficulty as Difficulty,
        `<@${submission.submitter_id}>`,
        HeistSystem.getTeammates(submission).map(t => `<@${t}>`),
        0, 0, false
      );
      response = { content: `❌ Rejected by <@${button.user.id}>`, files: [new AttachmentBuilder(buffer, { name: 'heist.png' })], components: [] };
    }

    if (!response) return;
    await button.update(response);

  } catch (err) {
    logger.error(String(err));
    try {
      if (button.deferred || button.replied) {
        await button.editReply('❌ Error').catch(() => null);
      } else {
        await button.reply({ content: '❌ Error', ephemeral: true }).catch(() => null);
      }
    } catch { /* swallow */ }
  }
}
