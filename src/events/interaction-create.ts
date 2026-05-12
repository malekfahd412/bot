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

  // ───────── BUTTON ONLY ─────────
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const button = interaction as ButtonInteraction;

  const isAdmin =
    button.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

  // ───────── ADMIN PANEL HANDLER ─────────
  if (button.customId.startsWith('admin:')) {
    // لو عندك admin system
    return;
  }

  // ───────── RESET ─────────
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

  // ───────── ADMIN GUARD ─────────
  if (!isAdmin) {
    await button.reply({
      content: '🚫 Admin only',
      ephemeral: true,
    });
    return;
  }

  await button.deferReply();

  try {

    const [action, id] = button.customId.split(':');

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

      await button.editReply({
        content: '✅ Approved',
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
      });
    }

    if (action === 'heist_reject') {
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

      await button.editReply({
        content: '❌ Rejected',
        files: [new AttachmentBuilder(buffer, { name: 'heist.png' })],
      });
    }

  } catch (err) {
    logger.error(String(err));
    await button.editReply('❌ Error').catch(() => null);
  }
}
