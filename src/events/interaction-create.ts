import {
  Events, Interaction, ChatInputCommandInteraction,
  ModalSubmitInteraction, EmbedBuilder, AttachmentBuilder, Collection,
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

  // ── Slash Commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: /${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command /${interaction.commandName} threw:`, err);
      const reply = { content: '❌ An error occurred. Please try again.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => null);
      } else {
        await interaction.reply(reply).catch(() => null);
      }
    }
    return;
  }

  // ── Modal Submissions ───────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(interaction as ModalSubmitInteraction, config.reviewChannelId);
      } catch (err) {
        logger.error('Modal handler error:', err);
        const reply = { content: '❌ Failed to process your submission.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => null);
        } else {
          await interaction.reply(reply).catch(() => null);
        }
      }
    }
    return;
  }

  // ── Button Interactions ─────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const colonIdx = interaction.customId.indexOf(':');
    if (colonIdx === -1) return;

    const action = interaction.customId.slice(0, colonIdx);
    const submissionId = interaction.customId.slice(colonIdx + 1);

    if (action !== 'heist_approve' && action !== 'heist_reject') return;

    // ── Role check ────────────────────────────────────────────────────────────
    if (config.adminRoleId) {
  const member = await interaction.guild?.members.fetch(interaction.user.id);

  if (!member) {
    return interaction.reply({
      content: '❌ Unable to verify your permissions.',
      ephemeral: true,
    });
  }

  const hasRole = member.roles.cache.has(config.adminRoleId);

  if (!hasRole) {
    return interaction.reply({
      content: '❌ You need the staff role to review heist submissions.',
      ephemeral: true,
    });
  }
}
    // Defer a new reply so we can attach the canvas card
    await interaction.deferReply();

    try {
      if (action === 'heist_approve') {
        const result = await ApprovalSystem.approve(submissionId, interaction.user.id);
        const { submission, xpAwarded, coinsAwarded, levelResults, skippedTeammates } = result;
        const teammates = HeistSystem.getTeammates(submission);

        // Canvas mission card
        const buffer = await generateMissionCard(
          submission.heist_name,
          submission.difficulty as Difficulty,
          `<@${submission.submitter_id}>`,
          teammates.map(t => `<@${t}>`),
          xpAwarded,
          coinsAwarded,
          true
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'mission-result.png' });

        // Build level-up notices
        const levelUpLines = levelResults
          .filter(r => r.leveledUp)
          .map(r => `🎉 <@${r.discordId}> reached **Level ${r.newLevel}**${r.rankChanged ? ` — ranked up to **${r.newRank}**` : ''}!`);

        const skipNote = skippedTeammates.length > 0
          ? `\n⚠️ Could not reward ${skippedTeammates.length} participant(s) (data error).`
          : '';

        await interaction.editReply({
          content: [
            `✅ **Approved** by <@${interaction.user.id}>`,
            `💰 **+${xpAwarded} XP** and **$${coinsAwarded.toLocaleString()}** distributed to **${levelResults.length}** participant(s).`,
            ...levelUpLines,
            skipNote,
          ].filter(Boolean).join('\n'),
          files: [attachment],
        });

      } else {
        // Reject
        const submission = ApprovalSystem.reject(submissionId, interaction.user.id);
        const teammates = HeistSystem.getTeammates(submission);

        const buffer = await generateMissionCard(
          submission.heist_name,
          submission.difficulty as Difficulty,
          `<@${submission.submitter_id}>`,
          teammates.map(t => `<@${t}>`),
          0, 0, false
        );

        const attachment = new AttachmentBuilder(buffer, { name: 'mission-result.png' });

        await interaction.editReply({
          content: `❌ **Rejected** by <@${interaction.user.id}>`,
          files: [attachment],
        });
      }

      // Disable the Approve/Reject buttons on the original review embed
      try {
        await interaction.message.edit({ components: [] });
      } catch {
        // Non-fatal — the message may have been deleted or we lack perms
      }

    } catch (err: unknown) {
      logger.error('Button handler error:', err);
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(`❌ ${msg}`).catch(() => null);
      } else {
        await interaction.reply({ content: `❌ ${msg}`, ephemeral: true }).catch(() => null);
      }
    }

    return;
  }
}
