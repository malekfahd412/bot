import { Interaction } from "discord.js";
import { handleAdminActions } from "./actions.js";

export async function handleAdminButtons(interaction: Interaction) {
  if (!interaction.isButton()) return;

  const id = interaction.customId;

  // ───── RESET SYSTEM ─────
  if (id === "admin_reset_menu") {
    return handleAdminActions.confirmReset(interaction);
  }

  if (id === "confirm_reset_yes") {
    return handleAdminActions.resetSystem(interaction);
  }

  if (id === "confirm_reset_no") {
    return interaction.reply({
      content: "❌ Cancelled",
      ephemeral: true,
    });
  }

  // ───── PLAYER MENU ─────
  if (id === "admin_player_menu") {
    return handleAdminActions.playerMenu(interaction);
  }

  if (id.startsWith("player_reset:")) {
    const playerId = id.split(":")[1];
    return handleAdminActions.resetPlayer(interaction, playerId);
  }

  // ───── HEIST MENU ─────
  if (id === "admin_heist_menu") {
    return handleAdminActions.heistMenu(interaction);
  }
}
