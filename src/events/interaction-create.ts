import {
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
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
import { logReset } from '../systems/logReset.js';
import type { Difficulty } from '../utils/constants.js';
import { config } from 'dotenv';

config();

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

  // ───────── Slash Commands ─────────
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(interaction);
    } catch (err: unknown) {
      logger.error(String(err));
    }
    return;
  }

  // ───────── Modal ─────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('heist_modal:')) {
      try {
        await handleHeistModal(
          interaction as ModalSubmitInteraction,
          configData.reviewChannelId
        );
      } catch (err: unknown) {
        logger.error(String(err));
        if (!interaction.replied) {
          await interaction.reply({
            content: '❌ Error processing submission',
            flags: 64,
          }).catch(() => null);
        }
      }
    }
    return;
  }

  // ───────── Buttons ─────────
  if (!interaction.isButton()) return;

  const [action, id] = interaction.customId.split(':');

  if (!interaction.inGuild()) return;

  const isAdmin =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  // ───────── 🔥 RESET BOT BUTTON ─────────
  if (interaction.customId === 'bot_reset_confirm') {
    if (!isAdmin) {
      return interaction.reply({
        content: '🚫 Admins only.',
        flags: 64,
      });
    }

    await interaction.reply({
      content: '🧹 Resetting bot commands...',
      flags: 64,
    });

    try {
      const rest = new REST({ version: '10' }).setToken(
        process.env.DISCORD_TOKEN!
      );

      // 🔥 DELETE ALL SLASH COMMANDS
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: [] }
      );

      await interaction.followUp({
        content: '✅ Bot reset completed. Run deploy again.',
        flags: 64,
      });

    } catch (err) {
      logger.error(String(err));
      await interaction.followUp({
        content: '❌ Reset failed.',
        flags: 64,
      });
    }

    return;
  }

  // ───────── Admin Guard (existing system) ─────────
  if (!isAdmin) {
    await interaction.reply({
      content: '🚫 Admins only.',
      flags: 64,
    }).catch(() => null);
    return;
  }

  await interaction.deferReply();

  try {
    if (action === 'heist_approve') {
      const result = await ApprovalSystem.approve(id, interaction.user.id);
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

      await interaction.editReply({
        content: `✅ Approved by <@${interaction.user.id}>`,
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
      });
    }

    if (action === 'heist_reject') {
      const submission = ApprovalSystem.reject(id, interaction.user.id);

      const buffer = await generateMissionCard(
        submission.heist_name,
        submission.difficulty as Difficulty,
        `<@${submission.submitter_id}>`,
        HeistSystem.getTeammates(submission).map(t => `<@${t}>`),
        0,
        0,
        false
      );

      await interaction.editReply({
        content: `❌ Rejected`,
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
      });
    }

    await interaction.message.edit({ components: [] }).catch(() => null);

  } catch (err: unknown) {
    logger.error(String(err));
    await interaction.editReply('❌ Something went wrong.').catch(() => null);
  }
}
