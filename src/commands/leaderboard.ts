import { ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { PlayerDB } from '../database/db.js';
import { generateLeaderboardCard } from '../canvas/leaderboard-card.js';
import { ThemeEngine } from '../systems/theme.js';
import { t } from '../utils/i18n.js';
import { logger } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top criminals in the underworld')
  .addStringOption(opt =>
    opt.setName('type')
      .setDescription('Sort by XP or Coins')
      .setRequired(false)
      .addChoices(
        { name: '⚔️ XP (Default)', value: 'xp' },
        { name: '💰 Coins',        value: 'coins' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const type    = (interaction.options.getString('type') ?? 'xp') as 'xp' | 'coins';
  const lang    = PlayerDB.getLanguage(interaction.user.id);
  const players = PlayerSystem.getLeaderboard(type, 10);

  if (players.length === 0) {
    await interaction.editReply(t(lang, 'commands.leaderboard.empty'));
    return;
  }

  const theme = ThemeEngine.getActive();

  try {
    const buffer     = await generateLeaderboardCard(players, type);
    const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

    const baseContent = type === 'xp'
      ? t(lang, 'commands.leaderboard.title_xp',    { count: players.length })
      : t(lang, 'commands.leaderboard.title_coins',  { count: players.length });

    const content = `${theme.emoji} ${baseContent}\n*${theme.randomAtmosphere()}*`;

    await interaction.editReply({ content, files: [attachment] });
  } catch (err) {
    logger.error('Leaderboard card generation failed:', err);
    await interaction.editReply(t(lang, 'commands.leaderboard.error'));
  }
}
