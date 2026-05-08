import {
  Events, Interaction, ChatInputCommandInteraction,
  ModalSubmitInteraction, AttachmentBuilder, Collection,
  PermissionFlagsBits,
} from 'discord.js';

import { logger } from '../utils/logger.js';
import { ApprovalSystem } from '../systems/approval.js';
import { HeistSystem } from '../systems/heist.js';
import { handleHeistModal } from '../commands/heist-log.js';
import { generateMissionCard } from '../canvas/mission-card.js';
import type { Difficulty } from '../utils/constants.js';

export const name = Events.InteractionCreate;
export const once = false;

type CommandModule = {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export async function execute(
  interaction: Interaction,
  commands: Collection<string, CommandModule>,
  config: { reviewChannelId?: string }
): Promise<void> {

  // ── Slash Commands ───────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(err);
      const reply = { content: '❌ Error occurred.', ephemeral: true };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => null);
      } else {
        await interaction.reply(reply).catch(() => null);
      }
    }
    return;
  }

  // ── Modal ────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(interaction as ModalSubmitInteraction, config.reviewChannelId);
      } catch (err) {
        logger.error(err);
        await interaction.reply({
          content: '❌ Failed to process submission.',
          ephemeral: true,
        }).catch(() => null);
      }
    }
    return;
  }

  // ── Buttons ──────────────────────────────────────────────────────
  if (interaction.isButton()) {

    const [action, submissionId] = interaction.customId.split(':');
    if (!action || !submissionId) return;

    if (action !== 'heist_approve' && action !== 'heist_reject') return;

    // ─────────────────────────────────────────────
    // 🔒 ADMIN ONLY CHECK (IMPORTANT CHANGE)
    // ─────────────────────────────────────────────
    const member = interaction.member;

    const isAdmin =
    interaction.inGuild() &&
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
    return interaction.reply({
    content: '🚫 Only Administrators can review heists.',
    ephemeral: true,
      });
    }

    await interaction.deferReply();

    try {
      if (action === 'heist_approve') {

        const result = await ApprovalSystem.approve(submissionId, interaction.user.id);

        const teammates = HeistSystem.getTeammates(result.submission);

        const buffer = await generateMissionCard(
          result.submission.heist_name,
          result.submission.difficulty as Difficulty,
          `<@${result.submission.submitter_id}>`,
          teammates.map(t => `<@${t}>`),
          result.xpAwarded,
          result.coinsAwarded,
          true
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'mission-result.png' });

        await interaction.editReply({
          content: `✅ Approved by <@${interaction.user.id}>`,
          files: [attachment],
        });

      } else {

        const submission = ApprovalSystem.reject(submissionId, interaction.user.id);
        const teammates = HeistSystem.getTeammates(submission);

        const buffer = await generateMissionCard(
          submission.heist_name,
          submission.difficulty as Difficulty,
          `<@${submission.submitter_id}>`,
          teammates.map(t => `<@${t}>`),
          0,
          0,
          false
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'mission-result.png' });

        await interaction.editReply({
          content: `❌ Rejected by <@${interaction.user.id}>`,
          files: [attachment],
        });
      }

      await interaction.message.edit({ components: [] }).catch(() => null);

    } catch (err) {
      logger.error(err);
      await interaction.editReply('❌ Something went wrong.').catch(() => null);
    }

    return;
  }
}
