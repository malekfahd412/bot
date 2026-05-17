import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';

import { CrewSystem } from '../systems/crew.js';
import { PlayerSystem } from '../systems/player.js';
import { generateCrewCard } from '../canvas/stats-card.js';
import { PlayerDB, CrewDB } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { formatCoins } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('crew')
  .setDescription('Crew system commands')
  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new crew')
      .addStringOption(o => o.setName('name').setDescription('Crew name (max 32 chars)').setRequired(true).setMaxLength(32))
      .addStringOption(o => o.setName('tag').setDescription('Short tag displayed next to your name (2–5 chars)').setRequired(true).setMaxLength(5).setMinLength(2))
      .addStringOption(o => o.setName('description').setDescription('Optional crew description').setRequired(false).setMaxLength(100))
  )
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View your crew card, or look up another crew')
      .addStringOption(o => o.setName('name').setDescription('Crew name to look up (leave blank for your crew)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('join')
      .setDescription('Join a crew by name')
      .addStringOption(o => o.setName('name').setDescription('Name of the crew to join').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('leave')
      .setDescription('Leave your current crew')
  )
  .addSubcommand(sub =>
    sub.setName('invite')
      .setDescription('Invite a player to your crew (owner only)')
      .addUserOption(o => o.setName('player').setDescription('Player to invite').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('View top crews ranked by total earnings')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  /* ─── CREATE ─── */
  if (sub === 'create') {
    await interaction.deferReply();

    const name = interaction.options.getString('name', true).trim();
    const tag = interaction.options.getString('tag', true).trim().toUpperCase();
    const description = interaction.options.getString('description') ?? undefined;

    PlayerSystem.getOrCreate(
      interaction.user.id,
      interaction.user.displayName,
      interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
    );

    try {
      const crew = CrewSystem.create(name, tag, interaction.user.id, description);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xC8A951)
          .setTitle(`🏴 Crew Created — ${crew.name}`)
          .setDescription(
            `**[${crew.tag}] ${crew.name}** is operational.\n\n` +
            `Invite members with \`/crew invite\` and run heists to build reputation.`
          )
          .addFields(
            { name: 'Tag', value: `[${crew.tag}]`, inline: true },
            { name: 'Members', value: '1', inline: true },
            { name: 'Owner', value: `<@${interaction.user.id}>`, inline: true },
          )
          .setFooter({ text: `Crew ID: ${crew.id.slice(0, 8)}` })
          .setTimestamp()],
      });
    } catch (err) {
      await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Failed to create crew.'}`);
    }
    return;
  }

  /* ─── INFO ─── */
  if (sub === 'info') {
    await interaction.deferReply();

    const nameQuery = interaction.options.getString('name');
    let crewData;

    if (nameQuery) {
      const raw = CrewDB.findByName(nameQuery.trim());
      if (!raw) {
        await interaction.editReply(`❌ No crew named **${nameQuery}** found.`);
        return;
      }
      crewData = CrewSystem.getCrew(raw.id);
    } else {
      crewData = CrewSystem.getPlayerCrew(interaction.user.id);
    }

    if (!crewData) {
      await interaction.editReply('❌ You are not in a crew. Use `/crew join <name>` or `/crew create`.');
      return;
    }

    const owner = PlayerDB.findByDiscordId(crewData.owner_id);
    if (!owner) {
      await interaction.editReply('❌ Crew owner data not found.');
      return;
    }

    try {
      const buffer = await generateCrewCard(crewData, crewData.members, owner);
      await interaction.editReply({
        files: [new AttachmentBuilder(buffer, { name: 'crew.png' })],
      });
    } catch (err) {
      logger.error('Crew card generation failed:', err);
      await interaction.editReply('❌ Failed to generate crew card.');
    }
    return;
  }

  /* ─── JOIN ─── */
  if (sub === 'join') {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true).trim();

    PlayerSystem.getOrCreate(
      interaction.user.id,
      interaction.user.displayName,
      interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
    );

    const crew = CrewDB.findByName(name);
    if (!crew) {
      await interaction.editReply(`❌ No crew named **${name}** found.`);
      return;
    }

    try {
      CrewSystem.join(crew.id, interaction.user.id);
      await interaction.editReply(`✅ You joined **[${crew.tag}] ${crew.name}**. Welcome to the crew.`);
    } catch (err) {
      await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Could not join crew.'}`);
    }
    return;
  }

  /* ─── LEAVE ─── */
  if (sub === 'leave') {
    await interaction.deferReply({ ephemeral: true });

    try {
      CrewSystem.leave(interaction.user.id);
      await interaction.editReply('✅ You have left your crew.');
    } catch (err) {
      await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Could not leave crew.'}`);
    }
    return;
  }

  /* ─── INVITE ─── */
  if (sub === 'invite') {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('player', true);
    const player = PlayerDB.findByDiscordId(interaction.user.id);

    if (!player?.crew_id) {
      await interaction.editReply('❌ You are not in a crew.');
      return;
    }

    const crew = CrewDB.findById(player.crew_id);
    if (!crew) {
      await interaction.editReply('❌ Crew not found.');
      return;
    }

    if (crew.owner_id !== interaction.user.id) {
      await interaction.editReply('❌ Only the crew owner can invite players.');
      return;
    }

    const targetPlayer = PlayerDB.findByDiscordId(target.id);
    if (targetPlayer?.crew_id) {
      await interaction.editReply(`❌ **${target.displayName}** is already in a crew.`);
      return;
    }

    try {
      PlayerSystem.getOrCreate(
        target.id,
        target.displayName,
        target.displayAvatarURL({ extension: 'png', size: 256 })
      );
      CrewSystem.join(crew.id, target.id);
      logger.game(`${interaction.user.id} invited ${target.id} to crew ${crew.name}`);
      await interaction.editReply(`✅ **${target.displayName}** has been added to **[${crew.tag}] ${crew.name}**.`);
    } catch (err) {
      await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Could not invite player.'}`);
    }
    return;
  }

  /* ─── LEADERBOARD ─── */
  if (sub === 'leaderboard') {
    await interaction.deferReply();

    const crews = CrewSystem.getLeaderboard(10);

    if (crews.length === 0) {
      await interaction.editReply('📭 No crews on record yet. Be the first to create one.');
      return;
    }

    const rows = crews.map((c, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
      return `${medal} **[${c.tag}] ${c.name}** — ${formatCoins(c.total_earnings)} · ${c.member_count} members · LVL ${c.level}`;
    }).join('\n');

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xC8A951)
        .setTitle('🏴 Crew Leaderboard')
        .setDescription(rows)
        .setFooter({ text: 'GTA Heist RPG • Ranked by total earnings' })
        .setTimestamp()],
    });
  }
}
