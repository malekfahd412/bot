import {
  Client, Events, Interaction, ChatInputCommandInteraction,
  ButtonInteraction, ModalSubmitInteraction, EmbedBuilder, AttachmentBuilder
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { ApprovalSystem } from '../systems/approval.js';
import { HeistSystem } from '../systems/heist.js';
import { PlayerSystem } from '../systems/player.js';
import { handleHeistModal } from '../commands/heist-log.js';
import { generateMissionCard } from '../canvas/mission-card.js';
import type { Difficulty } from '../utils/constants.js';

export const name = Events.InteractionCreate;
export const once = false;

type CommandModule = {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export async function execute(
  interaction: Interaction,
  commands: Map<string, CommandModule>,
  config: { reviewChannelId?: string; adminRoleId?: string }
): Promise<void> {
  // --- Slash Commands ---
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`Command error [${interaction.commandName}]:`, err);
      const msg = { content: '❌ An error occurred while executing this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // --- Modal Submissions ---
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      await handleHeistModal(interaction as ModalSubmitInteraction, config.reviewChannelId);
    }
    return;
  }

  // --- Button Interactions ---
  if (interaction.isButton()) {
    const [action, submissionId] = interaction.customId.split(':');

    if (action === 'heist_approve' || action === 'heist_reject') {
      // Check admin role
      const member = interaction.member;
      if (config.adminRoleId && member && 'roles' in member) {
        const roles = member.roles;
        const hasRole = 'cache' in roles
          ? roles.cache.has(config.adminRoleId)
          : (roles as string[]).includes(config.adminRoleId);

        if (!hasRole) {
          await interaction.reply({ content: '❌ You need the staff role to review heist submissions.', ephemeral: true });
          return;
        }
      }

      await interaction.deferReply();

      try {
        if (action === 'heist_approve') {
          const result = await ApprovalSystem.approve(submissionId, interaction.user.id);
          const submission = result.submission;
          const teammates = HeistSystem.getTeammates(submission);

          const buffer = await generateMissionCard(
            submission.heist_name,
            submission.difficulty as Difficulty,
            `<@${submission.submitter_id}>`,
            teammates.map(t => `<@${t}>`),
            result.xpAwarded,
            result.coinsAwarded,
            true
          );

          const attachment = new AttachmentBuilder(buffer, { name: 'mission-result.png' });
          const levelUpNotices = result.levelResults
            .filter(r => r.leveledUp)
            .map(r => `🎉 <@${r.discordId}> leveled up to **Level ${r.newLevel}**${r.rankChanged ? ` and ranked up to **${r.newRank}**` : ''}!`)
            .join('\n');

          await interaction.editReply({
            content: [
              `✅ **Heist approved** by <@${interaction.user.id}>`,
              `💰 Rewards distributed to **${1 + teammates.length}** participant(s).`,
              levelUpNotices ? `\n${levelUpNotices}` : '',
            ].filter(Boolean).join('\n'),
            files: [attachment],
          });

          // Disable buttons on review message
          try {
            const originalMsg = await interaction.message.fetch();
            await originalMsg.edit({ components: [] });
          } catch { /* ignore */ }

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
            content: `❌ **Heist rejected** by <@${interaction.user.id}>`,
            files: [attachment],
          });

          try {
            const originalMsg = await interaction.message.fetch();
            await originalMsg.edit({ components: [] });
          } catch { /* ignore */ }
        }
      } catch (err: unknown) {
        logger.error('Approval/rejection failed:', err);
        const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(`❌ ${errMsg}`);
        } else {
          await interaction.reply({ content: `❌ ${errMsg}`, ephemeral: true });
        }
      }
    }
    return;
  }
}
