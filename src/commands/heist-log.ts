import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
  TextChannel,
  Guild,
  UserSelectMenuBuilder,
  ComponentType,
  InteractionCollector,
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { HeistSystem } from '../systems/heist.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../utils/constants.js';
import { formatNumber } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

/* ───────────────────────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('heist-log')
  .setDescription('Submit a completed heist for staff review and rewards')
  .addStringOption(opt =>
    opt.setName('difficulty')
      .setDescription('Difficulty of the heist')
      .setRequired(true)
      .addChoices(
        { name: '🟢 Easy', value: 'easy' },
        { name: '🟡 Normal', value: 'normal' },
        { name: '🔴 Hard', value: 'hard' },
      )
  );

/* ───────────────────────────────────────────── */

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const difficulty = interaction.options.getString('difficulty', true) as Difficulty;
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  const modal = new ModalBuilder()
    .setCustomId(`heist_modal:${difficulty}`)
    .setTitle(`Heist Log — ${diffConfig.label}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('heist_name')
        .setLabel('Heist Name')
        .setPlaceholder('e.g. The Cayo Perico Job, Diamond Casino Heist')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('proof_url')
        .setLabel('Proof URL')
      .setPlaceholder('https://imgur.com/... or https://streamable.com/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('notes')
        .setLabel('Notes (optional)')
        .setPlaceholder('Any additional context about the heist...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    ),
  );

  await interaction.showModal(modal);
}

/* ───────────────────────────────────────────── */
/* USER SELECT MENU STEP (NEW UI) */
/* ───────────────────────────────────────────── */

async function askTeammates(interaction: ModalSubmitInteraction): Promise<string[]> {
  const hostId = interaction.user.id;

  const menu = new UserSelectMenuBuilder()
    .setCustomId('heist_team_select')
    .setPlaceholder('Select up to 3 teammates')
    .setMinValues(0)
    .setMaxValues(3);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu);

  await interaction.followUp({
    content: '👥 اختر أعضاء الفريق (حد أقصى 3)',
    components: [row],
    flags: 64,
  });

  return new Promise((resolve) => {
    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.UserSelect,
      time: 60000,
    });

    collector?.on('collect', async (i) => {
      if (i.customId !== 'heist_team_select') return;

      let users = i.values;

      // remove duplicates + host
      users = users.filter(u => u !== hostId);

      await i.update({
        content: `✅ Selected teammates: ${users.map(u => `<@${u}>`).join(', ') || 'None'}`,
        components: [],
      });

      collector.stop();
      resolve(users);
    });

    collector?.on('end', (_, reason) => {
      if (reason === 'time') resolve([]);
    });
  });
}

/* ───────────────────────────────────────────── */

export async function handleHeistModal(
  interaction: ModalSubmitInteraction,
  reviewChannelId: string | undefined
): Promise<void> {

  await interaction.deferReply({ flags: 64 });

  const [, difficulty] = interaction.customId.split(':') as [string, Difficulty];

  const heistName = interaction.fields.getTextInputValue('heist_name').trim();
  const proofUrl = interaction.fields.getTextInputValue('proof_url').trim();
  const notes = interaction.fields.getTextInputValue('notes') || '';

  const user = interaction.user;

  PlayerSystem.getOrCreate(
    user.id,
    user.username,
    user.displayAvatarURL({ extension: 'png', size: 256 })
  );

  // 👇 اختيار التيم باستخدام UI
  const teammates = await askTeammates(interaction);

  const finalTeam = [user.id, ...teammates].slice(0, 4);

  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const rewards = HeistSystem.calculateRewards(difficulty);

  try {
    const submission = HeistSystem.submit({
      submitterId: user.id,
      heistName,
      difficulty,
      teammates: finalTeam,
      proofUrl,
      notes: notes || undefined,
      submissionChannelId: interaction.channelId ?? undefined,
    });

    if (reviewChannelId && interaction.guild) {
      const channel = await fetchTextChannel(interaction.guild, reviewChannelId);

      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xC8A951)
          .setTitle(`HEIST — ${heistName}`)
          .setDescription(
            `**Host:** <@${user.id}>\n` +
            `**Team:** ${finalTeam.map(u => `<@${u}>`).join(', ')}\n` +
            `**Difficulty:** ${diffConfig.label}`
          )
          .addFields(
            { name: 'Proof', value: `[View](${proofUrl})`, inline: true },
            { name: 'XP', value: `~${formatNumber(rewards.xp)}`, inline: true },
            { name: 'Coins', value: `~$${formatNumber(rewards.coins)}`, inline: true },
          )
          .setThumbnail(user.displayAvatarURL())
          .setFooter({ text: `ID: ${submission.id}` })
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`heist_approve:${submission.id}`)
            .setLabel('APPROVE')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`heist_reject:${submission.id}`)
            .setLabel('REJECT')
            .setStyle(ButtonStyle.Danger),
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        HeistSystem.setReviewMessage(submission.id, msg.id);
      }
    }

    await interaction.editReply({
      content: `✅ Heist submitted successfully!\nID: \`${submission.id}\``,
    });

    logger.game(`Heist submitted by ${user.username}`);

  } catch (err) {
    logger.error(String(err));
    await interaction.editReply('❌ Failed to submit heist.');
  }
}

/* ───────────────────────────────────────────── */

async function fetchTextChannel(guild: Guild, id: string): Promise<TextChannel | null> {
  try {
    const cached = guild.channels.cache.get(id);
    if (cached?.isTextBased()) return cached as TextChannel;

    const fetched = await guild.channels.fetch(id);
    if (fetched?.isTextBased()) return fetched as TextChannel;

    return null;
  } catch {
    return null;
  }
}