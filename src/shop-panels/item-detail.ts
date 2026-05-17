import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { ShopItemDB } from '../database/db.js';
import { buildItemDetailEmbed } from '../shop-ui/embeds.js';
import { buildItemDetailRows } from '../shop-ui/buttons.js';

export async function showItemDetail(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  itemId: string,
): Promise<void> {
  const item = ShopItemDB.findById(itemId);
  if (!item) {
    await interaction.update({ content: '❌ Item not found.', embeds: [], components: [] });
    return;
  }

  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  const canAfford = player.coins >= item.price;
  const outOfStock = item.stock === 0;
  const embed = buildItemDetailEmbed(item, player);
  const rows = buildItemDetailRows(item, canAfford, outOfStock);

  await interaction.update({ embeds: [embed], components: rows });
}
