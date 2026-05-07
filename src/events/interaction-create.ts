import {
  Events, Interaction, ChatInputCommandInteraction,
  ModalSubmitInteraction, AttachmentBuilder, Collection,
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
  config: { reviewChannelId?: string; adminRoleId?: string }
): Promise<void> {

  // ── Slash Commands ─────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command error /${interaction.commandName}:`, err);

      const payload = {
        content: '❌ An error occurred. Please try again.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }

    return;
  }

  // ── Modal ─────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(
          interaction as ModalSubmitInteraction,
          config.reviewChannelId
        );
      } catch (err) {
        logger.error('Modal error:', err);

        const payload = {
          content: '❌ Failed to process submission.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => null);
        } else {
          await interaction.reply(payload).catch(() => null);
        }
      }
    }

    return;
  }

  // ── Buttons ─────────────────────────────
  if (!interaction.isButton()) return;

  const [action, submissionId] = interaction.customId.split(':');
  if (!action || !submissionId) return;

  if (action !== 'heist_approve' && action !== 'heist_reject') return;

  // ── Role check (FIXED) ─────────────────────────────
  if (config.adminRoleId) {
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      await interaction.reply({
        content: '❌ Unable to verify your permissions.',
        ephemeral: true,
      });
      return;
    }

    if (!member.roles.cache.has(config.adminRoleId)) {
      await interaction.reply({
        content: '❌ You need the staff role to review heists.',
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.deferReply();

  try {
    // ── APPROVE ─────────────────────────────
    if (action === 'heist_approve') {
      const result = await ApprovalSystem.approve(submissionId, interaction.user.id);

      const { submission, xpAwarded, coinsAwarded, levelResults, skippedTeammates } = result;

      const teammates = HeistSystem.getTeammates(submission);

      const buffer = await generateMissionCard(
        submission.heist_name,
        submission.difficulty as Difficulty,
        submission.submitter_id,
        teammates,
        xpAwarded,
        coinsAwarded,
        true
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: 'mission-result.png',
      });

      const levelUps = levelResults
        .filter(r => r.leveledUp)
        .map(r =>
          `🎉 <@${r.discordId}> reached **Level ${r.newLevel}**` +
          (r.rankChanged ? ` — **${r.newRank}**` : '')
        );

      await interaction.editReply({
        content: [
          `✅ Approved by <@${interaction.user.id}>`,
          `💰 +${xpAwarded} XP | $${coinsAwarded.toLocaleString()}`,
          ...levelUps,
        ].join('\n'),
        files: [attachment],
      });
    }

    // ── REJECT ─────────────────────────────
    else {
      const submission = ApprovalSystem.reject(submissionId, interaction.user.id);
      const teammates = HeistSystem.getTeammates(submission);

      const buffer = await generateMissionCard(
        submission.heist_name,
        submission.difficulty as Difficulty,
        submission.submitter_id,
        teammates,
        0,
        0,
        false
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: 'mission-result.png',
      });

      await interaction.editReply({
        content: `❌ Rejected by <@${interaction.user.id}>`,
        files: [attachment],
      });
    }

    // ── Disable buttons ─────────────────────
    try {
      await interaction.message.edit({ components: [] });
    } catch {}

  } catch (err) {
    logger.error('Button error:', err);

    const msg = err instanceof Error ? err.message : 'Unknown error';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`❌ ${msg}`).catch(() => null);
    } else {
      await interaction.reply({
        content: `❌ ${msg}`,
        ephemeral: true,
      }).catch(() => null);
    }
  }
}
