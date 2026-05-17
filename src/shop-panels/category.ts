import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { ShopItemDB } from '../database/db.js';
import { SHOP_CATEGORIES } from '../shop-ui/items-config.js';
import { buildCategoryEmbed } from '../shop-ui/embeds.js';
import { buildCategoryRows } from '../shop-ui/buttons.js';

const PAGE_SIZE = 8;

export async function showCategory(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  category: string,
  page: number,
): Promise<void> {
  const cat = SHOP_CATEGORIES[category as keyof typeof SHOP_CATEGORIES];
  if (!cat) {
    await interaction.update({ content: '❌ Unknown category.', embeds: [], components: [] });
    return;
  }

  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  const allItems = ShopItemDB.getByCategory(category);
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageItems = allItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const embed = buildCategoryEmbed(category as keyof typeof SHOP_CATEGORIES, pageItems, safePage, totalPages, player);
  const rows = buildCategoryRows(pageItems, category, safePage, totalPages);

  await interaction.update({ embeds: [embed], components: rows });
}
