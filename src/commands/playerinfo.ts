import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

import { fetchRockstarProfile } from "../services/rockstar-browser.js";

export const data = new SlashCommandBuilder()
  .setName("playerinfo")
  .setDescription("View Rockstar Social Club profile")
  .addStringOption(opt =>
    opt.setName("displayName")
      .setDescription("Rockstar displayName")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const displayName = interaction.options.getString("displayName", true);

  await interaction.deferReply();

  const profile = await fetchRockstarProfile(displayName);

  if (!profile) {
    return interaction.editReply("❌ Player not found or profile is private.");
  }

  const profileUrl = profile.profileUrl;

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)

    // 🎮 Title clickable
    .setTitle(`🎮 ${profile.displayName}`)
    .setURL(profileUrl)

    // 🖼️ Avatar (لو موجود)
    .setThumbnail(profile.avatar || null)

    // 👤 Layout GTA-style
    .setDescription(
`👤 **Player Info**
Username: **${profile.displayName}**

🕹️ **Social Club**
Status: Online info unavailable (API restricted)

👥 **Crew**
Data: (limited access via scraping)

🔗 **Profile**
[Open Rockstar Profile](${profileUrl})

──────────────`
    )

    .setFooter({
      text: "Rockstar Social Club Viewer • Unofficial API"
    });

  await interaction.editReply({
    embeds: [embed],
  });
}
