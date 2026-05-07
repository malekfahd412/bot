import {
  ChatInputCommandInteraction, SlashCommandBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { HeistSystem } from '../systems/heist.js';
import { DIFFICULTY_CONFIG, COLORS, type Difficulty } from '../utils/constants.js';
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
        { name: '🟡 Medium', value: 'medium' },
        { name: '🔴 Hard', value: 'hard' },
        { name: '🟣 Extreme', value: 'extreme' },
        { name: '🌟 Legendary', value: 'legendary' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const difficulty = interaction.options.getString('difficulty', true) as Difficulty;
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  const modal = new ModalBuilder()
    .setCustomId(`heist_modal:${difficulty}`)
    .setTitle(`🎯 Heist Log — ${diffConfig.label}`);

  const heistNameInput = new TextInputBuilder()
    .setCustomId('heist_name')
    .setLabel('Heist Name')
    .setPlaceholder('e.g. The Cayo Perico Job, Diamond Casino Heist')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const teammatesInput = new TextInputBuilder()
    .setCustomId('teammates')
    .setLabel('Teammates (mention up to 4, or leave blank)')
    .setPlaceholder('@user1 @user2 @user3')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  const proofInput = new TextInputBuilder()
    .setCustomId('proof_url')
    .setLabel('Proof URL (image/video link)')
    .setPlaceholder('https://imgur.com/... or https://streamable.com/...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(500);

  const notesInput = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('Notes (optional)')
    .setPlaceholder('Any additional context about the heist...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(heistNameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(teammatesInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(proofInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput),
  );

  await interaction.showModal(modal);
}

export async function handleHeistModal(interaction: import('discord.js').ModalSubmitInteraction, reviewChannelId: string | undefined): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const [, difficulty] = interaction.customId.split(':') as [string, Difficulty];
  const heistName = interaction.fields.getTextInputValue('heist_name').trim();
  const teammatesRaw = interaction.fields.getTextInputValue('teammates').trim();
  const proofUrl = interaction.fields.getTextInputValue('proof_url').trim();
  const notes = interaction.fields.getTextInputValue('notes').trim();

  const user = interaction.user;
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  PlayerSystem.getOrCreate(user.id, user.username, avatarUrl);

  const teammates = teammatesRaw
    ? [...teammatesRaw.matchAll(/<@!?(\d+)>/g)].map(m => m[1]).slice(0, 4)
    : [];

  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const estimatedXP = HeistSystem.calculateRewards(difficulty);

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

    // Post to review channel
    if (reviewChannelId) {
      const guild = (interaction as unknown as { guild: import('discord.js').Guild }).guild;
      const reviewChannel = guild?.channels.cache.get(reviewChannelId) as import('discord.js').TextChannel | undefined;

      if (reviewChannel) {
        const reviewEmbed = new EmbedBuilder()
          .setColor(0xC8A951)
          .setTitle(`📋 HEIST SUBMISSION — ${heistName.toUpperCase()}`)
          .setDescription(`**Difficulty:** ◆ ${diffConfig.label}\n**Submitted by:** <@${user.id}>`)
          .addFields(
            { name: '🎯 Heist', value: heistName, inline: true },
            { name: '⚡ Difficulty', value: diffConfig.label, inline: true },
            { name: '🤝 Teammates', value: teammates.length > 0 ? teammates.map(t => `<@${t}>`).join(', ') : 'Solo', inline: true },
            { name: '📎 Proof', value: `[View Proof](${proofUrl})`, inline: true },
            { name: '💰 Est. Reward', value: `~${estimatedXP.xp} XP / ~$${estimatedXP.coins}`, inline: true },
            ...(notes ? [{ name: '📝 Notes', value: notes }] : []),
          )
          .setThumbnail(user.displayAvatarURL())
          .setFooter({ text: `Submission ID: ${submission.id}` })
          .setTimestamp();

        const approveBtn = new ButtonBuilder()
          .setCustomId(`heist_approve:${submission.id}`)
          .setLabel('✅ APPROVE')
          .setStyle(ButtonStyle.Success);

        const rejectBtn = new ButtonBuilder()
          .setCustomId(`heist_reject:${submission.id}`)
          .setLabel('❌ REJECT')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn);

        const reviewMsg = await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });
        HeistSystem.setReviewMessage(submission.id, reviewMsg.id);
      }
    }

    await interaction.editReply({
      content: [
        `✅ **Heist submitted!** Your crew will be watching, boss.`,
        ``,
        `> 🎯 **${heistName}** (\`${diffConfig.label}\`)`,
        `> 📎 Proof submitted for staff review.`,
        `> 🆔 ID: \`${submission.id}\``,
        ``,
        `_Staff will review your submission. Rewards are paid on approval._`,
      ].join('\n'),
    });

    logger.game(`Heist submitted by ${user.username}: ${heistName} (${difficulty})`);
  } catch (err) {
    logger.error('Heist submission failed:', err);
    await interaction.editReply('❌ Failed to submit heist. Please try again.');
  }
}
