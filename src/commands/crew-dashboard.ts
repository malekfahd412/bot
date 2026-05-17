import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { showCrewHub } from '../crew-panels/hub.js';

export const data = new SlashCommandBuilder()
  .setName('crew')
  .setDescription('Open the Crew Hub — your faction command center');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  PlayerSystem.getOrCreate(
    interaction.user.id,
    interaction.user.displayName,
    interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  await showCrewHub(interaction);
}
