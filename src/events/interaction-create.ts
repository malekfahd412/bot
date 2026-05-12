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

import type { Difficulty } from '../utils/constants.js';

export const name = Events.InteractionCreate;

type CommandModule = {
  data: {
    name: string;
  };

  execute: (
    interaction: ChatInputCommandInteraction
  ) => Promise<void>;
};

export async function execute(
  interaction: Interaction,
  commands: Collection<string, CommandModule>,
  configData: {
    reviewChannelId?: string;
  }
): Promise<void> {

  // ─────────────────────────────
  // SLASH COMMANDS
  // ─────────────────────────────
  if (interaction.isChatInputCommand()) {

    const cmd = commands.get(interaction.commandName);

    if (!cmd) return;

    try {

      await cmd.execute(interaction);

    } catch (err) {

      logger.error(String(err));

      if (!interaction.replied) {

        await interaction.reply({
          content: '❌ Command error.',
          ephemeral: true,
        }).catch(() => null);
      }
    }

    return;
  }

  // ─────────────────────────────
  // MODALS
  // ─────────────────────────────
  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith('heist_modal:')) {

      try {

        await handleHeistModal(
          interaction as ModalSubmitInteraction,
          configData.reviewChannelId
        );

      } catch (err) {

        logger.error(String(err));

        if (!interaction.replied) {

          await interaction.reply({
            content: '❌ Error processing submission.',
            ephemeral: true,
          }).catch(() => null);
        }
      }
    }

    return;
  }

  // ─────────────────────────────
  // BUTTONS
  // ─────────────────────────────
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const button = interaction as ButtonInteraction;

  const isAdmin =
    button.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) ?? false;

  const [action, id] = button.customId.split(':');

  // ─────────────────────────────
  // RESET SYSTEM
  // ─────────────────────────────
  if (button.customId === 'bot_reset_confirm') {

    if (!isAdmin) {

      await button.reply({
        content: '🚫 Admins only.',
        ephemeral: true,
      });

      return;
    }

    await button.reply({
      content: '🧹 Reset started...',
      ephemeral: true,
    });

    try {

      const rest = new REST({
        version: '10',
      }).setToken(process.env.DISCORD_TOKEN!);

      const clientId =
        process.env.DISCORD_CLIENT_ID!;

      const logChannelId =
        process.env.RESET_LOG_CHANNEL_ID;

      // Delete commands
      await rest.put(
        Routes.applicationCommands(clientId),
        {
          body: [],
        }
      );

      // Log
      if (logChannelId) {

        const channel =
          await button.client.channels
            .fetch(logChannelId)
            .catch(() => null);

        if (channel && channel.isTextBased()) {

          await channel.send(
            `🚨 BOT RESET BY <@${button.user.id}>`
          );
        }
      }

      await button.followUp({
        content: '✅ Reset completed.',
        ephemeral: true,
      });

    } catch (err) {

      logger.error(String(err));

      await button.followUp({
        content: '❌ Reset failed.',
        ephemeral: true,
      }).catch(() => null);
    }

    return;
  }

  // ─────────────────────────────
  // ADMIN CHECK
  // ─────────────────────────────
  if (!isAdmin) {

    await button.reply({
      content: '🚫 Admins only.',
      ephemeral: true,
    }).catch(() => null);

    return;
  }

  await button.deferReply();

  try {

    // ─────────────────────────
    // APPROVE
    // ─────────────────────────
    if (action === 'heist_approve') {

      const result =
        await ApprovalSystem.approve(
          id,
          button.user.id
        );

      const teammates =
        HeistSystem.getTeammates(
          result.submission
        );

      const buffer =
        await generateMissionCard(
          result.submission.heist_name,
          result.submission
            .difficulty as Difficulty,
          `<@${result.submission.submitter_id}>`,
          teammates.map(
            (t) => `<@${t}>`
          ),
          result.xpAwarded,
          result.coinsAwarded,
          true
        );

      await button.editReply({
        content: `✅ Approved by <@${button.user.id}>`,
        files: [
          new AttachmentBuilder(buffer, {
            name: 'heist.png',
          }),
        ],
      });
    }

    // ─────────────────────────
    // REJECT
    // ─────────────────────────
    if (action === 'heist_reject') {

      const submission =
        ApprovalSystem.reject(
          id,
          button.user.id
        );

      const buffer =
        await generateMissionCard(
          submission.heist_name,
          submission.difficulty as Difficulty,
          `<@${submission.submitter_id}>`,
          HeistSystem
            .getTeammates(submission)
            .map((t) => `<@${t}>`),
          0,
          0,
          false
        );

      await button.editReply({
        content: `❌ Rejected`,
        files: [
          new AttachmentBuilder(buffer, {
            name: 'heist.png',
          }),
        ],
      });
    }

    await button.message
      .edit({
        components: [],
      })
      .catch(() => null);

  } catch (err) {

    logger.error(String(err));

    await button.editReply({
      content: '❌ Error',
    }).catch(() => null);
  }
}
