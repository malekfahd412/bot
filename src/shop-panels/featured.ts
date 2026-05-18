import { ButtonInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { ShopItemDB, InventoryDB } from '../database/db.js';
import { buildFeaturedEmbed, buildPurchaseSuccessEmbed } from '../shop-ui/embeds.js';
import { buildFeaturedRows } from '../shop-ui/buttons.js';
import { getDailyFeaturedKeys, DAILY_DISCOUNT } from '../shop-ui/items-config.js';

export async function showFeatured(interaction: ButtonInteraction): Promise<void> {
  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );
  const lang = player.language ?? 'en';

  const allItems = ShopItemDB.getAvailable();
  const featuredKeys = getDailyFeaturedKeys(allItems);
  const featuredItems = featuredKeys
    .map(k => allItems.find(i => i.item_key === k))
    .filter(Boolean) as typeof allItems;

  const embed = buildFeaturedEmbed(featuredItems, player, lang);
  const rows = buildFeaturedRows(featuredItems, player.coins, lang);

  await interaction.update({ embeds: [embed], components: rows });
}

export async function buyFeaturedItem(interaction: ButtonInteraction, itemId: string): Promise<void> {
  const item = ShopItemDB.findById(itemId);
  if (!item) {
    await interaction.update({ content: '❌ Item no longer exists.', embeds: [], components: [] });
    return;
  }

  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );
  const lang = player.language ?? 'en';

  const discountedPrice = Math.floor(item.price * (1 - DAILY_DISCOUNT));

  if (player.coins < discountedPrice) {
    await interaction.reply({ content: `❌ You need **$${discountedPrice.toLocaleString()}** but only have **$${player.coins.toLocaleString()}**.`, ephemeral: true });
    return;
  }
  if (!item.available) {
    await interaction.reply({ content: '❌ This item is no longer available.', ephemeral: true });
    return;
  }
  if (item.stock === 0) {
    await interaction.reply({ content: '❌ This item is out of stock.', ephemeral: true });
    return;
  }

  PlayerSystem.spendCoins(user.id, discountedPrice);
  InventoryDB.addItem(user.id, item);
  if (item.stock > 0) ShopItemDB.decrementStock(item.id);

  const updatedPlayer = PlayerSystem.getOrCreate(user.id, user.displayName, user.displayAvatarURL({ extension: 'png', size: 256 }));
  const embed = buildPurchaseSuccessEmbed({ ...item, price: discountedPrice }, updatedPlayer, lang);
  const allItems = ShopItemDB.getAvailable();
  const featuredItems = getDailyFeaturedKeys(allItems)
    .map(k => allItems.find(i => i.item_key === k))
    .filter(Boolean) as typeof allItems;
  const rows = buildFeaturedRows(featuredItems, updatedPlayer.coins, lang);

  await interaction.update({ embeds: [embed], components: rows });
}
