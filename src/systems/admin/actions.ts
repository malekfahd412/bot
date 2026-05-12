import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  Interaction,
} from "discord.js";
import { logger } from "../../utils/logger.js";

export const handleAdminActions = {
  // ───────── CONFIRM RESET ─────────
  async confirmReset(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_reset_yes")
        .setLabel("YES RESET")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("confirm_reset_no")
        .setLabel("CANCEL")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      content: "⚠ Are you sure you want to reset the system?",
      components: [row],
      ephemeral: true,
    });
  },

  // ───────── RESET SYSTEM ─────────
  async resetSystem(interaction: Interaction) {
    if (!interaction.isButton()) return;

    await interaction.reply({
      content: "🧹 Resetting system...",
      ephemeral: true,
    });

    try {
      const rest = new REST({ version: "10" }).setToken(
        process.env.DISCORD_TOKEN!
      );

      const clientId = process.env.DISCORD_CLIENT_ID!;

      await rest.put(Routes.applicationCommands(clientId), {
        body: [],
      });

      return interaction.followUp({
        content: "✅ System reset completed",
        ephemeral: true,
      });
    } catch (err) {
      logger.error(err);
      return interaction.followUp({
        content: "❌ Reset failed",
        ephemeral: true,
      });
    }
  },

  // ───────── PLAYER MENU ─────────
  async playerMenu(interaction: Interaction) {
    if (!interaction.isButton()) return;

    return interaction.reply({
      content: "👤 Player tools coming soon...",
      ephemeral: true,
    });
  },

  // ───────── RESET PLAYER ─────────
  async resetPlayer(interaction: Interaction, playerId: string) {
    if (!interaction.isButton()) return;

    return interaction.reply({
      content: `🧹 Reset player <@${playerId}> (system hook ready)`,
      ephemeral: true,
    });
  },

  // ───────── HEIST MENU ─────────
  async heistMenu(interaction: Interaction) {
    if (!interaction.isButton()) return;

    return interaction.reply({
      content: "🔥 Heist tools coming soon...",
      ephemeral: true,
    });
  },
};
