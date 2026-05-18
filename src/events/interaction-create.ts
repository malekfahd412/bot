import {
  Events, Interaction, ChatInputCommandInteraction,
  ModalSubmitInteraction, ButtonInteraction,
  AttachmentBuilder, Collection, PermissionFlagsBits, REST, Routes,
  StringSelectMenuInteraction,
} from 'discord.js';

import { logger } from '../utils/logger.js';
import { Health } from '../utils/health.js';
import { InteractionGuard } from '../utils/interaction-guard.js';
import { ApprovalSystem } from '../systems/approval.js';
import { HeistSystem } from '../systems/heist.js';
import { getEventEngine } from '../systems/events.js';
import { handleHeistModal } from '../commands/heist-log.js';
import { handleAdminButton } from '../commands/admin.js';
import { generateMissionCard } from '../canvas/mission-card.js';
import { handleCrewJoin } from '../interactions/crewJoin.js';
import { routeCrewButton, routeCrewSelect, routeCrewModal } from '../crew-interactions/router.js';
import { routeShopButton, routeShopSelect, routeShopModal } from '../shop-interactions/router.js';
import { routeWarEventButton, routeEventPanelButton, routeEventPanelSelect, routeEventPanelModal, routeEventHistoryButton } from '../event-interactions/router.js';
import type { Difficulty } from '../utils/constants.js';

export const name = Events.InteractionCreate;

type CommandModule = {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

/* ── Safe reply helper — never throws ──────────────────────────────────── */
async function safeReplyError(interaction: Interaction, message = '❌ An error occurred.'): Promise<void> {
  try {
    if ((interaction as ChatInputCommandInteraction).replied || (interaction as ChatInputCommandInteraction).deferred) {
      await (interaction as ChatInputCommandInteraction).editReply(message).catch(() => null);
    } else {
      await (interaction as ChatInputCommandInteraction).reply({ content: message, ephemeral: true }).catch(() => null);
    }
  } catch { /* silently swallow — we never want the error handler itself to crash */ }
}

export async function execute(
  interaction: Interaction,
  commands: Collection<string, CommandModule>,
  configData: { reviewChannelId?: string }
): Promise<void> {

  // ── Deduplication: ignore already-processing interactions ───────────────
  if (!InteractionGuard.tryAcquire(interaction.id)) {
    logger.warn(`[InteractionGuard] Duplicate interaction ignored: ${interaction.id}`);
    return;
  }

  Health.recordInteraction();

  /* ─── SLASH COMMANDS ─── */
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      Health.recordError();
      logger.error(`[Command] /${interaction.commandName} error:`, err);
      await safeReplyError(interaction, '❌ Error executing command. Please try again.');
    }
    return;
  }

  /* ─── MODALS ─── */
  if (interaction.isModalSubmit()) {
    const modal = interaction as ModalSubmitInteraction;

    try {
      if (await routeEventPanelModal(modal)) return;
      if (await routeShopModal(modal)) return;
      if (await routeCrewModal(modal)) return;

      if (modal.customId.startsWith('heist_modal:')) {
        await handleHeistModal(modal, configData.reviewChannelId);
      }
    } catch (err) {
      Health.recordError();
      logger.error(`[Modal] ${modal.customId} error:`, err);
      await safeReplyError(modal, '❌ Failed to process your submission. Please try again.');
    }
    return;
  }

  /* ─── SELECT MENUS ─── */
  if (interaction.isStringSelectMenu()) {
    const select = interaction as StringSelectMenuInteraction;

    try {
      if (await routeEventPanelSelect(select)) return;
      if (await routeShopSelect(select)) return;
      if (await routeCrewSelect(select)) return;
    } catch (err) {
      Health.recordError();
      logger.error(`[SelectMenu] ${select.customId} error:`, err);
      await safeReplyError(select, '❌ Failed to process selection.');
    }
    return;
  }

  /* ─── BUTTONS ─── */
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const button   = interaction as ButtonInteraction;
  const customId = button.customId;
  const [action] = customId.split(':');

  /* ─── EVENT HISTORY PAGINATION ─── */
  if (customId.startsWith('ehist:')) {
    try { await routeEventHistoryButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Event history error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── EVENT PANEL BUTTONS (admin) ─── */
  if (customId.startsWith('evp:')) {
    try { await routeEventPanelButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Event panel error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── WAR EVENT BUTTONS (player announcement) ─── */
  if (customId.startsWith('war_event:')) {
    try { await routeWarEventButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] War event error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── SHOP BUTTONS ─── */
  if (customId.startsWith('shop:') || customId.startsWith('shopadm:')) {
    try { await routeShopButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Shop error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── CREW BUTTONS ─── */
  if (customId.startsWith('crew:')) {
    try { await routeCrewButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Crew error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── EVENT ENGINE ─── */
  if (action === 'event_join') {
    const eventId = customId.slice('event_join:'.length);
    const engine = getEventEngine();
    if (!engine) {
      await button.reply({ content: '⚠️ Event engine is offline.', ephemeral: true }).catch(() => null);
      return;
    }
    try { await engine.handleJoin(button, eventId); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Event join error:', err);
      await safeReplyError(button);
    }
    return;
  }

  if (action === 'event_skip') {
    const engine = getEventEngine();
    try { await engine?.handleSkip(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Event skip error:', err);
    }
    return;
  }

  /* ─── CREW JOIN (legacy) ─── */
  if (action === 'crew_join') {
    try { await handleCrewJoin(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Crew join error:', err);
      await button.reply({ content: '❌ Failed to join crew', ephemeral: true }).catch(() => null);
    }
    return;
  }

  /* ─── ADMIN SYSTEM ─── */
  if (action === 'admin_panel' || action === 'admin_confirm' || action === 'admin_cancel') {
    const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    if (!isAdmin) { await button.reply({ content: '🚫 Admin only.', ephemeral: true }).catch(() => null); return; }
    try { await handleAdminButton(button); }
    catch (err) {
      Health.recordError();
      logger.error('[Button] Admin panel error:', err);
      await safeReplyError(button);
    }
    return;
  }

  /* ─── BOT RESET ─── */
  if (customId === 'bot_reset_confirm') {
    const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    if (!isAdmin) { await button.reply({ content: '🚫 Admin only', ephemeral: true }).catch(() => null); return; }
    await button.reply({ content: '🧹 Resetting commands...', ephemeral: true }).catch(() => null);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: [] });
      await button.followUp({ content: '✅ Commands cleared.', ephemeral: true }).catch(() => null);
    } catch (err) {
      Health.recordError();
      logger.error('[Button] Bot reset error:', err);
    }
    return;
  }

  /* ─── ADMIN GUARD for heist approve/reject ─── */
  const isAdmin = button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  if (!isAdmin) { await button.reply({ content: '🚫 Admin only', ephemeral: true }).catch(() => null); return; }

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
    Health.recordError();
    logger.error('[Button] Heist review error:', err);
    try {
      if (button.deferred || button.replied) {
        await button.editReply('❌ Error processing review.').catch(() => null);
      } else {
        await button.reply({ content: '❌ Error processing review.', ephemeral: true }).catch(() => null);
      }
    } catch { /* swallow — error handler must never throw */ }
  }
}
