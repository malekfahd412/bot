import { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { ShopItemDB } from '../database/db.js';
import { buildMainEmbed } from '../shop-ui/embeds.js';
import { buildMainRows } from '../shop-ui/buttons.js';

export async function showShopMain(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  update = false,
): Promise<void> {
  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );
  const allItems = ShopItemDB.getAvailable();
  const embed = buildMainEmbed(player, allItems);
  const rows = buildMainRows();

  if (update && interaction.isButton()) {
    await interaction.update({ embeds: [embed], components: rows });
  } else {
    const ci = interaction as ChatInputCommandInteraction;
    await ci.editReply({ embeds: [embed], components: rows });
  }
}
