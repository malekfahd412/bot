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
import type { Difficulty } from '../utils/constants.js';
import { handleAdminButtons } from "../systems/admin/buttons.js";

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

  // ───────── Buttons only ─────────
  if (!interaction.isButton()) return;
  if (!interaction.inGuild()) return;

  const isAdmin =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  const [action, id] = interaction.customId.split(':');

  // ───────────────────────────────
  // 🔥 RESET SYSTEM (GTA ADMIN MENU)
  // ───────────────────────────────
  if (interaction.customId === 'bot_reset_confirm') {

    if (!isAdmin) {
      await interaction.reply({
        content: "🚫 Admins only.",
        ephemeral: true,
      });

      return;
    }

    await interaction.reply({
      content: '🧹 Reset started... wiping bot commands & cache.',
      flags: 64,
    });

    try {
      const rest = new REST({ version: '10' }).setToken(
        process.env.DISCORD_TOKEN!
      );

      const clientId = process.env.DISCORD_CLIENT_ID!;
      const logChannelId = process.env.RESET_LOG_CHANNEL_ID;

      // 1️⃣ Delete ALL global commands
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: [] }
      );

      // 2️⃣ Optional log
      if (logChannelId) {
        const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);

        if (channel && channel.isTextBased()) {
          await channel.send(
            `🚨 **BOT RESET EXECUTED**\n👮 By: <@${interaction.user.id}>\n🕒 ${new Date().toISOString()}`
          );
        }
      }

      // 3️⃣ Confirm
      await interaction.followUp({
        content: '✅ Reset completed. Now run deploy-commands.js again.',
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

  // ───────── Admin Guard for everything else ─────────
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
