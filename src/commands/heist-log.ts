import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalSubmitInteraction, TextChannel, Guild,
} from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { HeistSystem } from '../systems/heist.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../utils/constants.js';
import { formatNumber } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

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
        .setMaxLength(64)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('teammates')
        .setLabel('Teammates (mention up to 4, or leave blank)')
        .setPlaceholder('@user1 @user2 @user3')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('proof_url')
        .setLabel('Proof URL (image/video link)')
        .setPlaceholder('https://imgur.com/... or https://streamable.com/...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('notes')
        .setLabel('Notes (optional)')
        .setPlaceholder('Any additional context about the heist...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500)
    ),
  );

  await interaction.showModal(modal);
}

export async function handleHeistModal(
  interaction: ModalSubmitInteraction,
  reviewChannelId: string | undefined
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const [, difficulty] = interaction.customId.split(':') as [string, Difficulty];
  const heistName = interaction.fields.getTextInputValue('heist_name').trim();
  const teammatesRaw = interaction.fields.getTextInputValue('teammates').trim();
  const proofUrl = interaction.fields.getTextInputValue('proof_url').trim();
  const notes = interaction.fields.getTextInputValue('notes').trim();

  const user = interaction.user;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  PlayerSystem.getOrCreate(user.id, user.username, avatarUrl);

  // Parse teammate mentions
  const teammates = teammatesRaw
    ? [...teammatesRaw.matchAll(/<@!?(\d+)>/g)].map(m => m[1]).filter(id => id !== user.id).slice(0, 4)
    : [];

  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const estimatedRewards = HeistSystem.calculateRewards(difficulty);

  try {
    const submission = HeistSystem.submit({
      submitterId: user.id,
      heistName,
      difficulty,
      teammates,
      proofUrl,
      notes: notes || undefined,
      submissionChannelId: interaction.channelId ?? undefined,
    });

    // Post to the staff review channel
    if (reviewChannelId && interaction.guild) {
      try {
        const reviewChannel = await fetchTextChannel(interaction.guild, reviewChannelId);

        if (reviewChannel) {
          const reviewEmbed = new EmbedBuilder()
            .setColor(0xC8A951)
            .setTitle(`HEIST SUBMISSION — ${heistName.toUpperCase()}`)
            .setDescription(
              `**Difficulty:** ${diffConfig.label}\n` +
              `**Submitted by:** <@${user.id}>\n` +
              `**Teammates:** ${teammates.length > 0 ? teammates.map(t => `<@${t}>`).join(', ') : 'Solo'}`
            )
            .addFields(
              { name: 'Proof', value: `[Click to view](${proofUrl})`, inline: true },
              { name: 'Est. XP', value: `~${formatNumber(estimatedRewards.xp)}`, inline: true },
              { name: 'Est. Coins', value: `~$${formatNumber(estimatedRewards.coins)}`, inline: true },
              ...(notes ? [{ name: 'Notes', value: notes }] : []),
            )
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: `Submission ID: ${submission.id}` })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`heist_approve:${submission.id}`)
              .setLabel('APPROVE')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`heist_reject:${submission.id}`)
              .setLabel('REJECT')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger),
          );

          const reviewMsg = await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });
          HeistSystem.setReviewMessage(submission.id, reviewMsg.id);
          logger.game(`Review embed posted to #${reviewChannel.name} for submission ${submission.id}`);
        } else {
          logger.warn(`Review channel ${reviewChannelId} not found or not a text channel`);
        }
      } catch (channelErr) {
        logger.warn(`Could not post to review channel: ${String(channelErr)}`);
      }
    }

    await interaction.editReply({
      content: [
        `✅ **Heist submitted successfully!** Stand by for staff review.`,
        ``,
        `> **${heistName}** — ${diffConfig.label}`,
        `> Proof attached. Rewards distributed on approval.`,
        `> Submission ID: \`${submission.id}\``,
      ].join('\n'),
    });

    logger.game(`Heist submitted by ${user.username}: "${heistName}" (${difficulty})`);
  } catch (err) {
    logger.error('Heist submission failed:', err);
    await interaction.editReply('❌ Failed to submit heist. Please try again.');
  }
}

async function fetchTextChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
  try {
    // Check cache first, then fetch from API
    const cached = guild.channels.cache.get(channelId);
    if (cached?.isTextBased()) return cached as TextChannel;

    const fetched = await guild.channels.fetch(channelId);
    if (fetched?.isTextBased()) return fetched as TextChannel;

    return null;
  } catch {
    return null;
  }
}
