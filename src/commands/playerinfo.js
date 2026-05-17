"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const rockstar_browser_js_1 = require("../services/rockstar-browser.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("playerinfo")
    .setDescription("View Rockstar Social Club profile")
    .addStringOption(opt => opt.setName("display_name")
    .setDescription("Rockstar display_name")
    .setRequired(true));
async function execute(interaction) {
    const display_name = interaction.options.getString("display_name", true);
    await interaction.deferReply();
    const profile = await (0, rockstar_browser_js_1.fetchRockstarProfile)(display_name);
    if (!profile) {
        return interaction.editReply("❌ Player not found or profile is private.");
    }
    const profileUrl = profile.profileUrl;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xC8A951)
        // 🎮 Title clickable
        .setTitle(`🎮 ${profile.display_name}`)
        .setURL(profileUrl)
        // 🖼️ Avatar (لو موجود)
        .setThumbnail(profile.avatar || null)
        // 👤 Layout GTA-style
        .setDescription(`👤 **Player Info**
Username: **${profile.display_name}**

🕹️ **Social Club**
Status: Online info unavailable (API restricted)

👥 **Crew**
Data: (limited access via scraping)

🔗 **Profile**
[Open Rockstar Profile](${profileUrl})

──────────────`)
        .setFooter({
        text: "Rockstar Social Club Viewer • Unofficial API"
    });
    await interaction.editReply({
        embeds: [embed],
    });
}
//# sourceMappingURL=playerinfo.js.map