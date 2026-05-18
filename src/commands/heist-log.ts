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
} from 'discord.js';

import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { HeistSystem } from '../systems/heist.js';
import { DIFFICULTY_CONFIG, type Difficulty } from '../utils/constants.js';
import { t } from '../utils/i18n.js';
import { formatNumber } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

/* ─────────────────────────── COMMAND ─────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('heist-log')
  .setDescription('Submit a completed heist for staff review and rewards')
  .addStringOption(opt =>
    opt.setName('difficulty')
      .setDescription('Difficulty of the heist')
      .setRequired(true)
      .addChoices(
        { name: '🟢 Easy',   value: 'easy' },
        { name: '🟡 Normal', value: 'normal' },
        { name: '🔴 Hard',   value: 'hard' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const difficulty  = interaction.options.getString('difficulty', true) as Difficulty;
  const diffConfig  = DIFFICULTY_CONFIG[difficulty];
  const lang        = PlayerDB.getLanguage(interaction.user.id);

  const modal = new ModalBuilder()
    .setCustomId(`heist_modal:${difficulty}`)
    .setTitle(t(lang, 'commands.heist_log.modal_title', { difficulty: diffConfig.label }));

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('heist_name')
        .setLabel(t(lang, 'commands.heist_log.field_name'))
        .setPlaceholder(t(lang, 'commands.heist_log.field_name_placeholder'))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('proof_url')
        .setLabel(t(lang, 'commands.heist_log.field_proof'))
        .setPlaceholder(t(lang, 'commands.heist_log.field_proof_placeholder'))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('notes')
        .setLabel(t(lang, 'commands.heist_log.field_notes'))
        .setPlaceholder(t(lang, 'commands.heist_log.field_notes_placeholder'))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    ),
  );

  await interaction.showModal(modal);
}

/* ─────────────────────────── TEAMMATE SELECTOR ─────────────────────────── */

async function askTeammates(interaction: ModalSubmitInteraction, lang: string): Promise<string[]> {
  const hostId = interaction.user.id;

  const menu = new UserSelectMenuBuilder()
    .setCustomId('heist_team_select')
    .setPlaceholder(t(lang, 'commands.heist_log.teammates_prompt'))
    .setMinValues(0)
    .setMaxValues(3);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu);

  await interaction.followUp({
    content:    t(lang, 'commands.heist_log.teammates_prompt'),
    components: [row],
    flags:      64,
  });

  return new Promise((resolve) => {
    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.UserSelect,
      time:          60_000,
      filter:        (i) => i.user.id === hostId && i.customId === 'heist_team_select',
    });

    collector?.once('collect', async (i) => {
      const users = i.values.filter(u => u !== hostId);

      const locked = t(lang, 'commands.heist_log.teammates_locked', {
        list: users.map(u => `<@${u}>`).join(', ') || t(lang, 'commands.heist_log.teammates_solo'),
      });

      await i.update({ content: locked, components: [] });
      collector.stop('collected');
      resolve(users);
    });

    collector?.on('end', (_collected, reason) => {
      if (reason !== 'collected') resolve([]);
    });
  });
}

/* ─────────────────────────── MODAL HANDLER ─────────────────────────── */

export async function handleHeistModal(
  interaction: ModalSubmitInteraction,
  reviewChannelId: string | undefined
): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const [, difficulty] = interaction.customId.split(':') as [string, Difficulty];
  const heistName      = interaction.fields.getTextInputValue('heist_name').trim();
  const proofUrl       = interaction.fields.getTextInputValue('proof_url').trim();
  const notes          = interaction.fields.getTextInputValue('notes').trim();
  const user           = interaction.user;
  const lang           = PlayerDB.getLanguage(user.id);

  PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 })
  );

  const teammates  = await askTeammates(interaction, lang);
  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const rewards    = HeistSystem.calculateRewards(difficulty);

  try {
    const submission = HeistSystem.submit({
      submitterId:         user.id,
      heistName,
      difficulty,
      teammates,
      proofUrl,
      notes:               notes || undefined,
      submissionChannelId: interaction.channelId ?? undefined,
    });

    if (reviewChannelId && interaction.guild) {
      const channel = await fetchTextChannel(interaction.guild, reviewChannelId);

      if (channel) {
        const allParticipants = [user.id, ...teammates];

        const embed = new EmbedBuilder()
          .setColor(0xC8A951)
          .setTitle(`HEIST — ${heistName}`)
          .setDescription(
            `**Host:** <@${user.id}>\n` +
            `**Team:** ${allParticipants.map(u => `<@${u}>`).join(', ')}\n` +
            `**Difficulty:** ${diffConfig.label}`
          )
          .addFields(
            { name: 'Proof',       value: `[View](${proofUrl})`,          inline: true },
            { name: 'Est. XP',     value: `~${formatNumber(rewards.xp)}`, inline: true },
            { name: 'Est. Coins',  value: `~$${formatNumber(rewards.coins)}`, inline: true },
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
      content: t(lang, 'commands.heist_log.submitted', { id: submission.id.slice(0, 8) }),
    });

    logger.game(`Heist submitted by ${user.displayName} — ${heistName} (${difficulty})`);

  } catch (err) {
    logger.error('Heist modal submission failed:', err);
    await interaction.editReply(t(lang, 'commands.heist_log.error'));
  }
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

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
