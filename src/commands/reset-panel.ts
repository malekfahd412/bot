import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";

export const data = {
  name: "reset-panel",
  description: "Open bot reset control panel",
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("bot_reset_confirm")
      .setLabel("⚠ RESET BOT")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    content: "⚠ Admin Panel: Reset bot system?",
    components: [row],
    ephemeral: true,
  });
}
