import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('playerinfo')
  .setDescription('Show Rockstar profile info')
  .addStringOption(opt =>
    opt
      .setName('username')
      .setDescription('Rockstar username')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {

  const username = interaction.options.getString('username', true);

  // مثال داتا مؤقتة
  // بعدين تربطها بـ API حقيقي
  const player = {
    username: username,
    rid: '260174764',
    country: '🇪🇬 EG',
    friends: 58,
    hidden: 'No',

    crewName: 'Red Dead Rustlers',
    crewTag: 'RDR',
    crewMotto: 'Be quick on the draw, or deal with the consequences.',
    crewMembers: '1268102',
    division: '101-1000',

    game: 'GTAV',
    platform: 'PC',
    date: 'Tue, 05 May 2026 21:00:00 UTC',
  };

  const profileUrl =
    `https://socialclub.rockstargames.com/member/${encodeURIComponent(username)}`;

  const embed = new EmbedBuilder()
    .setColor(0xC8A951)

    // 👇 الاسم يبقى لينك
    .setTitle(`🎮 ${player.username}`)
    .setURL(profileUrl)

    .setDescription(
`👤 **Player Info**
**Username:** ${player.username}
**RID:** ${player.rid}
**Country:** ${player.country}
**Friends:** ${player.friends}
**Profile Hidden:** ${player.hidden}

👥 **Crew**
**Name:** ${player.crewName}
**Tag:** [${player.crewTag}]
**Motto:** ${player.crewMotto}
**Members:** ${player.crewMembers}
**Division:** ${player.division}

🕒 **Last Seen**
**Game:** ${player.game}
**Platform:** ${player.platform}
**Date:** ${player.date}

🔗 **Linked**
Google
Discord`
    )

    .setFooter({
      text: 'Rockstar Social Club'
    })

    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
