import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, EmbedBuilder,
} from 'discord.js';
import { WarEventDB, EventTeamDB, EventParticipantDB, CrewDB } from '../database/db.js';
import {
  WarEventManager, SCORE_ACTIONS, ScoreAction,
  buildEventAnnouncementEmbed, buildLeaderboardEmbed, buildEventEndEmbed,
} from '../systems/war-event.js';
import { PlayerSystem } from '../systems/player.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('🏴 Crew War Event system')
  /* ── create ── */
  .addSubcommand(sub => sub
    .setName('create')
    .setDescription('Admin: Create and announce a new Crew War Event')
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true).setMaxLength(60))
    .addIntegerOption(o => o.setName('reward_xp').setDescription('XP reward for winning crew members (default 500)').setMinValue(0))
    .addIntegerOption(o => o.setName('reward_coins').setDescription('Coin reward for winning crew members (default 5000)').setMinValue(0))
  )
  /* ── end ── */
  .addSubcommand(sub => sub
    .setName('end')
    .setDescription('Admin: End the active event and distribute rewards')
  )
  /* ── join ── */
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join the current active event with your crew')
  )
  /* ── leave ── */
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the current active event')
  )
  /* ── status ── */
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('View the current event leaderboard')
  )
  /* ── score ── */
  .addSubcommand(sub => sub
    .setName('score')
    .setDescription('Admin: Log a score action for a crew')
    .addStringOption(o => o.setName('crew').setDescription('Crew name or tag').setRequired(true))
    .addStringOption(o => o
      .setName('action')
      .setDescription('Score action to apply')
      .setRequired(true)
      .addChoices(
        { name: '✅ Heist Success (+100)', value: 'success' },
        { name: '💎 Perfect Heist (+150)',  value: 'perfect' },
        { name: '❌ Heist Failed (-50)',    value: 'fail'    },
        { name: '⭐ Bonus Objective (+75)', value: 'bonus'   },
      )
    )
    .addStringOption(o => o.setName('note').setDescription('Optional note to attach to the log').setMaxLength(80))
  );

/* ─────────────────────────────────────────────────────────────────────────
   EXECUTE
───────────────────────────────────────────────────────────────────────── */

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(true);

  /* ────── /event create ────── */
  if (sub === 'create') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const title      = interaction.options.getString('title', true);
    const rewardXp   = interaction.options.getInteger('reward_xp')    ?? 500;
    const rewardCoins = interaction.options.getInteger('reward_coins') ?? 5000;

    let event;
    try {
      event = WarEventManager.create(title, rewardXp, rewardCoins, interaction.user.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply(`❌ ${msg}`);
      return;
    }

    const embed = buildEventAnnouncementEmbed(event, []);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`war_event:join:${event.id}`)
        .setLabel('⚔️ Join Event')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`war_event:status:${event.id}`)
        .setLabel('📊 View Leaderboard')
        .setStyle(ButtonStyle.Secondary),
    );

    const sent = await interaction.editReply({ embeds: [embed], components: [row] });

    WarEventDB.setAnnouncementMessage(event.id, sent.id, interaction.channelId);
    logger.info(`War event created: "${title}" by ${interaction.user.tag}`);
    return;
  }

  /* ────── /event end ────── */
  if (sub === 'end') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const active = WarEventDB.getActive();
    if (!active) {
      await interaction.editReply('❌ No active event to end.');
      return;
    }

    const result = WarEventManager.endEvent(active.id, interaction.client);

    if (result.ok === false) {
      await interaction.editReply(`❌ ${result.reason}`);
      return;
    }

    const teams = EventTeamDB.getTeams(active.id);
    const embed = buildEventEndEmbed({ ...active, status: 'ended', ended_at: new Date().toISOString() }, teams);

    await interaction.editReply({ embeds: [embed] });
    logger.info(`War event ended: "${active.title}" — winner: ${result.winner?.crew_name ?? 'none'}, rewarded: ${result.rewardedCount}`);
    return;
  }

  /* ────── /event join ────── */
  if (sub === 'join') {
    await interaction.deferReply({ ephemeral: true });

    const active = WarEventDB.getActive();
    if (!active) {
      await interaction.editReply('❌ There is no active event right now.');
      return;
    }

    const user = interaction.user;
    const result = WarEventManager.joinEvent(
      active.id, user.id, user.displayName,
      user.displayAvatarURL({ extension: 'png', size: 256 }),
    );

    if (result.ok === false) {
      await interaction.editReply(`❌ ${result.reason}`);
      return;
    }

    void WarEventManager.updateAnnouncementMessage(active, interaction.client);
    await interaction.editReply(`✅ You've joined **${active.title}** representing **${result.crewName}**! Good luck, criminal.`);
    return;
  }

  /* ────── /event leave ────── */
  if (sub === 'leave') {
    await interaction.deferReply({ ephemeral: true });

    const active = WarEventDB.getActive();
    if (!active) {
      await interaction.editReply('❌ No active event.');
      return;
    }

    const result = WarEventManager.leaveEvent(active.id, interaction.user.id);
    if (result.ok === false) {
      await interaction.editReply(`❌ ${result.reason}`);
      return;
    }

    await interaction.editReply('👋 You have left the event.');
    return;
  }

  /* ────── /event status ────── */
  if (sub === 'status') {
    await interaction.deferReply({ ephemeral: true });

    const active = WarEventDB.getActive();
    if (!active) {
      const history = WarEventDB.getHistory(1);
      if (history.length > 0) {
        const last = history[0];
        const teams = EventTeamDB.getTeams(last.id);
        const embed = buildEventEndEmbed(last, teams);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply('❌ No active event. Ask an admin to start one with `/event create`.');
      }
      return;
    }

    const teams = EventTeamDB.getTeams(active.id);
    const embed = buildLeaderboardEmbed(active, teams);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  /* ────── /event score ────── */
  if (sub === 'score') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const active = WarEventDB.getActive();
    if (!active) {
      await interaction.editReply('❌ No active event.');
      return;
    }

    const crewInput = interaction.options.getString('crew', true).trim();
    const action    = interaction.options.getString('action', true) as ScoreAction;
    const note      = interaction.options.getString('note') ?? undefined;

    const crew = CrewDB.findByName(crewInput) ?? CrewDB.findByTag(crewInput);
    if (!crew) {
      await interaction.editReply(`❌ Crew \`${crewInput}\` not found. Use the exact crew name or tag.`);
      return;
    }

    const result = WarEventManager.logScore(active.id, crew.id, action, note);

    if (result.ok === false) {
      await interaction.editReply(`❌ ${result.reason}`);
      return;
    }

    const cfg = SCORE_ACTIONS[action];
    await interaction.editReply(
      `${cfg.emoji} Logged **${cfg.label}** (${cfg.delta > 0 ? '+' : ''}${cfg.delta} pts) for **[${result.team.crew_tag}] ${result.team.crew_name}**.\n` +
      `New score: \`${result.team.score} pts\``
    );

    void WarEventManager.updateAnnouncementMessage(active, interaction.client);
    return;
  }
}
