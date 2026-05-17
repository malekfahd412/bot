import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { CrewSystem } from '../systems/crew.js';
import { generateCrewCard } from '../canvas/crew-card.js';
import { PlayerDB } from '../database/db.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('crew')
  .setDescription('Manage your crew')

  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new crew')
      .addStringOption(o =>
        o.setName('name')
          .setDescription('Crew name (2–32 chars)')
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('tag')
          .setDescription('Crew tag (2–5 chars, e.g. RSC)')
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('description')
          .setDescription('Short description')
          .setRequired(false)
      )
  )

  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View your crew info card')
      .addStringOption(o =>
        o.setName('name')
          .setDescription('Crew name (optional — defaults to your crew)')
          .setRequired(false)
      )
  )

  .addSubcommand(sub =>
    sub.setName('join')
      .setDescription('Join a crew by name')
      .addStringOption(o =>
        o.setName('name')
          .setDescription('Crew name to join')
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub.setName('leave')
      .setDescription('Leave your current crew')
  )

  .addSubcommand(sub =>
    sub.setName('invite')
      .setDescription('Invite a player to your crew')
      .addUserOption(o =>
        o.setName('player')
          .setDescription('Player to invite')
          .setRequired(true)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {

  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();

  const user = interaction.user;

  // =========================
  // DISPLAY NAME FIX
  // =========================

  PlayerSystem.getOrCreate(
    user.id,
    interaction.user.displayName,
    user.displayAvatarURL({
      extension: 'png',
      size: 256
    })
  );

  // =========================
  // CREATE
  // =========================

  if (sub === 'create') {

    const name = interaction.options
      .getString('name', true)
      .trim();

    const tag = interaction.options
      .getString('tag', true)
      .trim()
      .toUpperCase();

    const description = interaction.options
      .getString('description')
      ?.trim();

    try {

      const crew = CrewSystem.create(
        name,
        tag,
        user.id,
        description
      );

      await interaction.editReply({
        content: [
          `✅ **Crew created!** Welcome to the underworld, boss.`,
          ``,
          `> 🏴 **${crew.name}** [\`${crew.tag}\`]`,
          `> 👑 Owner: <@${user.id}>`,
          `> 👥 Members: 1`,
        ].join('\n'),
      });

    } catch (err) {

      await interaction.editReply(
        `❌ ${
          err instanceof Error
            ? err.message
            : 'Failed to create crew.'
        }`
      );
    }

    return;
  }

  // =========================
  // INFO
  // =========================

  if (sub === 'info') {

    const crewName =
      interaction.options.getString('name');

    let crew;

    if (crewName) {

      const found = await import('../database/db.js')
        .then(m => m.CrewDB.findByName(crewName));

      if (!found) {

        await interaction.editReply(
          '❌ Crew not found.'
        );

        return;
      }

      crew = CrewSystem.getWithMembers(found.id);

    } else {

      crew = CrewSystem.getPlayerCrew(user.id);
    }

    if (!crew) {

      await interaction.editReply(
        '❌ You are not in a crew. Create or join one first.'
      );

      return;
    }

    const owner = PlayerDB.findByDiscordId(
      crew.owner_id
    );

    if (!owner) {

      await interaction.editReply(
        '❌ Crew data error.'
      );

      return;
    }

    try {

      const buffer = await generateCrewCard(
        crew,
        crew.members,
        owner
      );

      const attachment = new AttachmentBuilder(
        buffer,
        { name: 'crew.png' }
      );

      await interaction.editReply({
        content:
          `> 🏴 **${crew.name}** — Crew Dossier`,
        files: [attachment]
      });

    } catch (err) {

      logger.error(
        'Crew card generation failed:',
        err
      );

      await interaction.editReply(
        '❌ Failed to generate crew card.'
      );
    }

    return;
  }

  // =========================
  // JOIN
  // =========================

  if (sub === 'join') {

    const name = interaction.options
      .getString('name', true)
      .trim();

    const { CrewDB } = await import('../database/db.js');

    const found = CrewDB.findByName(name);

    if (!found) {

      await interaction.editReply(
        '❌ Crew not found.'
      );

      return;
    }

    try {

      CrewSystem.join(found.id, user.id);

      await interaction.editReply(
        `✅ You've joined **${found.name}** [\`${found.tag}\`]. Welcome to the family.`
      );

    } catch (err) {

      await interaction.editReply(
        `❌ ${
          err instanceof Error
            ? err.message
            : 'Failed to join crew.'
        }`
      );
    }

    return;
  }

  // =========================
  // LEAVE
  // =========================

  if (sub === 'leave') {

    try {

      CrewSystem.leave(user.id);

      await interaction.editReply(
        '✅ You have left your crew. You\'re on your own now, boss.'
      );

    } catch (err) {

      await interaction.editReply(
        `❌ ${
          err instanceof Error
            ? err.message
            : 'Failed to leave crew.'
        }`
      );
    }

    return;
  }

  // =========================
  // INVITE
  // =========================

  if (sub === 'invite') {

    const target =
      interaction.options.getUser(
        'player',
        true
      );

    const player =
      PlayerSystem.get(user.id);

    if (!player?.crew_id) {

      await interaction.editReply(
        '❌ You are not in a crew.'
      );

      return;
    }

    const { CrewDB } =
      await import('../database/db.js');

    const crew =
      CrewDB.findById(player.crew_id);

    if (
      !crew ||
      crew.owner_id !== user.id
    ) {

      await interaction.editReply(
        '❌ Only the crew owner can invite members.'
      );

      return;
    }

    try {

      // =========================
      // DISPLAY NAME FIX
      // =========================

      PlayerSystem.getOrCreate(
        target.id,
        target.displayName,
        target.displayAvatarURL({
          extension: 'png',
          size: 256
        })
      );

      CrewSystem.join(
        player.crew_id,
        target.id
      );

      await interaction.editReply(
        `✅ **${target.displayName}** has been added to **${crew.name}**. One more soldier in the family.`
      );

    } catch (err) {

      await interaction.editReply(
        `❌ ${
          err instanceof Error
            ? err.message
            : 'Failed to invite player.'
        }`
      );
    }

    return;
  }
}