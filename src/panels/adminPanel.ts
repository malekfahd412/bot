import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  Client,
} from "discord.js";

export async function sendAdminPanel(client: Client, channelId: string) {
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("⚙ GTA ADMIN CONTROL PANEL")
    .setDescription("Manage the entire server system from here.")
    .setColor(0xffcc00)
    .addFields(
      { name: "🧹 Reset System", value: "Wipe bot data & commands", inline: false },
      { name: "👤 Player Tools", value: "Reset / Manage players", inline: false },
      { name: "🔥 Heist Control", value: "Approve or reject missions", inline: false }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_reset_system")
      .setLabel("RESET SYSTEM")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("admin_player_tools")
      .setLabel("PLAYER PANEL")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_heist_tools")
      .setLabel("HEIST PANEL")
      .setStyle(ButtonStyle.Success)
  );

  await (channel as TextChannel).send({
    embeds: [embed],
    components: [row1],
  });
}
