import {
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  AttachmentBuilder,
  Collection,
  PermissionFlagsBits,
  REST,
  Routes,
} from 'discord.js';

import { logger } from '../utils/logger.js';
import { ApprovalSystem } from '../systems/approval.js';
import { HeistSystem } from '../systems/heist.js';
import { handleHeistModal } from '../commands/heist-log.js';
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

  // ───────── SLASH ─────────
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(interaction);
    } catch (err) {
      logger.error(String(err));

      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Error executing command',
          ephemeral: true,
        }).catch(() => null);
      }
    }
    return;
  }

  // ───────── MODAL ─────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(
          interaction as ModalSubmitInteraction,
          configData.reviewChannelId
        );
      } catch (err) {
        logger.error(String(err));
      }
    }
    return;
  }

  // ───────── SELECT MENU (CREW DASHBOARD) ─────────
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

  // ───────── BUTTON HANDLER ─────────
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const button = interaction as ButtonInteraction;

  // =========================
  // CREW JOIN BUTTON (PUBLIC)
  // =========================
  if (button.customId.startsWith('crew_join:')) {
    try {
      await handleCrewJoin(button);
    } catch (err) {
      logger.error(String(err));

      await button.reply({
        content: '❌ Failed to join crew',
        ephemeral: true,
      }).catch(() => null);
    }
    return;
  }

  // =========================
  // ADMIN CHECK
  // =========================
  const isAdmin =
    button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  // =========================
  // ADMIN PANEL BYPASS
  // =========================
  if (button.customId.startsWith('admin:')) return;

  // =========================
  // RESET BOT COMMAND
  // =========================
  if (button.customId === 'bot_reset_confirm') {

    if (!isAdmin) {
      await button.reply({
        content: '🚫 Admin only',
        ephemeral: true,
      });
      return;
    }

    await button.reply({
      content: '🧹 Reset running...',
      ephemeral: true,
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    try {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: [] }
      );

      await button.followUp({
        content: '✅ Reset done',
        ephemeral: true,
      });

    } catch (err) {
      logger.error(String(err));
    }

    return;
  }

  // =========================
  // ADMIN GUARD
  // =========================
  if (!isAdmin) {
    await button.reply({
      content: '🚫 Admin only',
      ephemeral: true,
    });
    return;
  }

  const [action, id] = button.customId.split(':');

  try {
    let response;

    // =========================
    // APPROVE HEIST
    // =========================
    if (action === 'heist_approve') {

      const result = await ApprovalSystem.approve(id, button.user.id);

      const buffer = await generateMissionCard(
        result.submission.heist_name,
        result.submission.difficulty as Difficulty,
        `<@${result.submission.submitter_id}>`,
        HeistSystem.getTeammates(result.submission).map(t => `<@${t}>`),
        result.xpAwarded,
        result.coinsAwarded,
        true
      );

      response = {
        content: `✅ Approved by <@${button.user.id}>`,
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
        components: []
      };
    }

    // =========================
    // REJECT HEIST
    // =========================
    else if (action === 'heist_reject') {

      const submission = ApprovalSystem.reject(id, button.user.id);

      const buffer = await generateMissionCard(
        submission.heist_name,
        submission.difficulty as Difficulty,
        `<@${submission.submitter_id}>`,
        HeistSystem.getTeammates(submission).map(t => `<@${t}>`),
        0,
        0,
        false
      );

      response = {
        content: `❌ Rejected by <@${button.user.id}>`,
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
        components: []
      };
    }

    if (!response) return;

    await button.update(response);

  } catch (err) {
    logger.error(String(err));

    try {
      if (button.deferred || button.replied) {
        await button.editReply('❌ Error').catch(() => null);
      } else {
        await button.reply({
          content: '❌ Error',
          ephemeral: true,
        }).catch(() => null);
      }
    } catch {}
  }
}
