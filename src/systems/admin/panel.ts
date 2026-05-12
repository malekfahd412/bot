import {
  Client,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export async function sendAdminPanel(client: Client, channelId: string) {
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("🛠 GTA ADMIN CONTROL PANEL")
    .setDescription("Full system control dashboard")
    .setColor(0xff0000)
    .addFields(
      {
        name: "🧹 Reset System",
        value: "Wipe bot commands & data",
        inline: false,
      },
      {
        name: "👤 Player Tools",
        value: "Reset / manage players",
        inline: false,
      },
      {
        name: "🔥 Heist Control",
        value: "Approve / reject missions",
        inline: false,
      }
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_reset_menu")
      .setLabel("RESET SYSTEM")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("admin_player_menu")
      .setLabel("PLAYER PANEL")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_heist_menu")
      .setLabel("HEIST PANEL")
      .setStyle(ButtonStyle.Success)
  );

  await (channel as TextChannel).send({
    embeds: [embed],
    components: [row],
  });
}
