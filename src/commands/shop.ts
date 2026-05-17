import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { showShopMain } from '../shop-panels/main.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Open the Los Santos Black Market — buy items, boosts, and gear');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  PlayerSystem.getOrCreate(
    interaction.user.id,
    interaction.user.displayName,
    interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  await showShopMain(interaction, false);
}
