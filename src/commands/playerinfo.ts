import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { fetchRockstarProfile } from "../services/rockstar-profile.js";

export const data = new SlashCommandBuilder()
  .setName("playerinfo")
  .setDescription("Fetch Rockstar profile")
  .addStringOption(opt =>
    opt.setName("username")
      .setDescription("Rockstar username")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const username = interaction.options.getString("username", true);

  await interaction.deferReply();

  const data = await fetchRockstarProfile(username);

  if (!data) {
    return interaction.editReply("❌ Player not found or profile is private.");
  }

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(`🎮 ${data.username}`)
    .setURL(data.profileUrl)
    .setThumbnail(data.avatar || null)
    .setDescription(
`👤 **Rockstar Profile**
Username: ${data.username}

👥 **Crew**
${data.crewName ? data.crewName : "No crew data available"}

🔗 [Open Profile](${data.profileUrl})`
    )
    .setFooter({ text: "Rockstar Social Club Viewer" });

  await interaction.editReply({ embeds: [embed] });
}
