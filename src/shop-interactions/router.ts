import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, PermissionFlagsBits } from 'discord.js';
import { ShopItemDB, InventoryDB, PlayerDB, BoostDB } from '../database/db.js';
import { PlayerSystem } from '../systems/player.js';
import { showShopMain } from '../shop-panels/main.js';
import { showCategory } from '../shop-panels/category.js';
import { showItemDetail } from '../shop-panels/item-detail.js';
import { showInventory } from '../shop-panels/inventory.js';
import { showFeatured, buyFeaturedItem } from '../shop-panels/featured.js';
import {
  showAdminPanel, showAdminItem,
  showAddItemModal, showEditPriceModal, showEditItemModal,
  toggleItemAvailable, toggleItemFeatured, deleteItem,
} from '../shop-panels/admin-panel.js';
import { buildPurchaseSuccessEmbed, buildUseItemEmbed } from '../shop-ui/embeds.js';
import { buildItemDetailRows, buildInventoryRows } from '../shop-ui/buttons.js';
import { RARITY_CONFIG } from '../shop-ui/items-config.js';
import { ShopItem } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database/db.js';
import { logger } from '../utils/logger.js';

/* ─────────────────────────────────────────────────────────────────────────
   BUTTON ROUTER  (customId starts with shop: or shopadm:)
───────────────────────────────────────────────────────────────────────── */

export async function routeShopButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;

  /* ── Player shop buttons ── */
  if (id === 'shop:main') {
    await showShopMain(interaction, true);
    return true;
  }

  if (id === 'shop:feat') {
    await showFeatured(interaction);
    return true;
  }

  if (id.startsWith('shop:cat:')) {
    const parts = id.split(':');
    const category = parts[2];
    const page = parseInt(parts[3] ?? '0', 10) || 0;
    await showCategory(interaction, category, page);
    return true;
  }

  if (id.startsWith('shop:item:')) {
    const itemId = id.slice('shop:item:'.length);
    await showItemDetail(interaction, itemId);
    return true;
  }

  if (id.startsWith('shop:inv:')) {
    const page = parseInt(id.split(':')[2] ?? '0', 10) || 0;
    await showInventory(interaction, page);
    return true;
  }

  if (id.startsWith('shop:buy:')) {
    const itemId = id.slice('shop:buy:'.length);
    await handlePurchase(interaction, itemId, false);
    return true;
  }

  if (id.startsWith('shop:buyfeat:')) {
    const itemId = id.slice('shop:buyfeat:'.length);
    await buyFeaturedItem(interaction, itemId);
    return true;
  }

  /* ── Admin shop buttons ── */
  if (id.startsWith('shopadm:')) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
      return true;
    }

    if (id === 'shopadm:add') {
      await showAddItemModal(interaction);
      return true;
    }

    if (id.startsWith('shopadm:panel:')) {
      // Handles: shopadm:panel:<page>  |  shopadm:panel:<page>:prev  |  shopadm:panel:<page>:next  |  shopadm:panel:<page>:back
      const page = parseInt(id.split(':')[2] ?? '0', 10) || 0;
      await showAdminPanel(interaction, page);
      return true;
    }

    if (id.startsWith('shopadm:manage:')) {
      const parts = id.split(':');
      const itemId = parts[2];
      const page = parseInt(parts[3] ?? '0', 10) || 0;
      await showAdminItem(interaction, itemId, page);
      return true;
    }

    if (id.startsWith('shopadm:edit_price:')) {
      const itemId = id.slice('shopadm:edit_price:'.length);
      await showEditPriceModal(interaction, itemId);
      return true;
    }

    if (id.startsWith('shopadm:edit_item:')) {
      const itemId = id.slice('shopadm:edit_item:'.length);
      await showEditItemModal(interaction, itemId);
      return true;
    }

    if (id.startsWith('shopadm:toggle_avail:')) {
      const itemId = id.slice('shopadm:toggle_avail:'.length);
      await toggleItemAvailable(interaction, itemId);
      return true;
    }

    if (id.startsWith('shopadm:toggle_feat:')) {
      const itemId = id.slice('shopadm:toggle_feat:'.length);
      await toggleItemFeatured(interaction, itemId);
      return true;
    }

    if (id.startsWith('shopadm:delete:')) {
      const itemId = id.slice('shopadm:delete:'.length);
      await deleteItem(interaction, itemId);
      return true;
    }

  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   SELECT MENU ROUTER  (customId starts with shop_sel: or shopadm_sel:)
───────────────────────────────────────────────────────────────────────── */

export async function routeShopSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const id = interaction.customId;
  const value = interaction.values[0];

  if (id.startsWith('shop_sel:item:')) {
    await showItemDetail(interaction, value);
    return true;
  }

  if (id === 'shop_sel:use') {
    await handleUseItem(interaction, value);
    return true;
  }

  if (id.startsWith('shopadm_sel:item:')) {
    const page = parseInt(id.split(':')[2] ?? '0', 10) || 0;
    await showAdminItem(interaction, value, page);
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL ROUTER  (customId starts with shop_mod:)
───────────────────────────────────────────────────────────────────────── */

export async function routeShopModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const id = interaction.customId;

  if (id === 'shop_mod:add_item') {
    await handleAddItemModal(interaction);
    return true;
  }

  if (id.startsWith('shop_mod:edit_price:')) {
    const itemId = id.slice('shop_mod:edit_price:'.length);
    await handleEditPriceModal(interaction, itemId);
    return true;
  }

  if (id.startsWith('shop_mod:edit_item:')) {
    const itemId = id.slice('shop_mod:edit_item:'.length);
    await handleEditItemModal(interaction, itemId);
    return true;
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────────────────
   PURCHASE HANDLER
───────────────────────────────────────────────────────────────────────── */

async function handlePurchase(interaction: ButtonInteraction, itemId: string, featured: boolean): Promise<void> {
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

  if (!item.available) {
    await interaction.reply({ content: '❌ This item is no longer available.', ephemeral: true });
    return;
  }
  if (item.stock === 0) {
    await interaction.reply({ content: '❌ This item is out of stock.', ephemeral: true });
    return;
  }
  if (player.coins < item.price) {
    const need = item.price - player.coins;
    await interaction.reply({
      content: `❌ You're **$${need.toLocaleString()}** short. Current balance: **$${player.coins.toLocaleString()}**.`,
      ephemeral: true,
    });
    return;
  }

  PlayerSystem.spendCoins(user.id, item.price);
  InventoryDB.addItem(user.id, item);
  if (item.stock > 0) ShopItemDB.decrementStock(item.id);

  const updated = PlayerDB.findByDiscordId(user.id)!;
  const lang = updated.language ?? 'en';
  const embed = buildPurchaseSuccessEmbed(item, updated, lang);
  const rows = buildItemDetailRows(item, updated.coins >= item.price, item.stock === 1, lang);

  await interaction.update({ embeds: [embed], components: rows });
}

/* ─────────────────────────────────────────────────────────────────────────
   USE ITEM HANDLER
───────────────────────────────────────────────────────────────────────── */

async function handleUseItem(interaction: StringSelectMenuInteraction, inventoryItemId: string): Promise<void> {
  const invItem = InventoryDB.findById(inventoryItemId);
  if (!invItem || invItem.player_id !== interaction.user.id) {
    await interaction.reply({ content: '❌ Item not found in your inventory.', ephemeral: true });
    return;
  }

  const shopItem = ShopItemDB.findByKey(invItem.item_key);
  if (!shopItem) {
    await interaction.reply({ content: '❌ Item definition not found.', ephemeral: true });
    return;
  }

  let boost = null;
  let crateReward: ShopItem | null = null;

  if (shopItem.effect_type === 'LOOT_CRATE') {
    crateReward = rollCrate(shopItem.effect_value);
    if (crateReward) {
      InventoryDB.addItem(interaction.user.id, crateReward);
    }
  } else if (shopItem.effect_duration > 0) {
    boost = BoostDB.activate(interaction.user.id, shopItem);
  }

  InventoryDB.removeOne(inventoryItemId);

  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(user.id, user.displayName, user.displayAvatarURL({ extension: 'png', size: 256 }));
  const lang = player.language ?? 'en';

  const embed = buildUseItemEmbed(invItem, boost, crateReward, lang);
  const allInv = InventoryDB.getPlayer(user.id);
  const boosts = BoostDB.getActive(user.id);
  const rows = buildInventoryRows(allInv, 0, Math.max(1, Math.ceil(allInv.length / 6)), lang);

  await interaction.update({ embeds: [embed], components: rows });
}

function rollCrate(tier: number): ShopItem | null {
  const allItems = ShopItemDB.getAvailable();
  let pool: ShopItem[];

  if (tier >= 2) {
    pool = allItems.filter(i => (i.rarity === 'rare' || i.rarity === 'epic') && i.effect_type !== 'LOOT_CRATE');
  } else {
    pool = allItems.filter(i => (i.rarity === 'common' || i.rarity === 'uncommon') && i.effect_type !== 'LOOT_CRATE');
  }

  if (!pool.length) pool = allItems.filter(i => i.effect_type !== 'LOOT_CRATE');
  if (!pool.length) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}

/* ─────────────────────────────────────────────────────────────────────────
   ADD ITEM MODAL HANDLER
───────────────────────────────────────────────────────────────────────── */

async function handleAddItemModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const itemKey = interaction.fields.getTextInputValue('item_key').trim().replace(/\s+/g, '_').toLowerCase();
    const namePriceRarity = interaction.fields.getTextInputValue('name_price_rarity');
    const description = interaction.fields.getTextInputValue('description').trim();
    const effectLine = interaction.fields.getTextInputValue('effect_type_value');

    const [name, priceStr, rarity, category, icon] = namePriceRarity.split('|').map(s => s.trim());
    const [effectType, effectValueStr, durationStr] = effectLine.split('|').map(s => s.trim());

    const price = parseInt(priceStr ?? '0', 10);
    const effectValue = parseFloat(effectValueStr ?? '0');
    const effectDuration = parseInt(durationStr ?? '0', 10);

    const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const VALID_CATEGORIES = ['boosts', 'consumables', 'tools', 'crates', 'crew', 'special'];
    const VALID_EFFECTS = ['XP_BOOST', 'COIN_BOOST', 'HEAT_REDUCTION', 'HEIST_TOOL', 'LUCKY_CHARM', 'CREW_BOOST', 'LOOT_CRATE', 'NONE'];

    if (!name || !itemKey) { await interaction.editReply('❌ Name and key are required.'); return; }
    if (isNaN(price) || price < 0) { await interaction.editReply('❌ Invalid price.'); return; }
    if (!VALID_RARITIES.includes(rarity ?? '')) { await interaction.editReply(`❌ Rarity must be one of: ${VALID_RARITIES.join(', ')}`); return; }
    if (!VALID_CATEGORIES.includes(category ?? '')) { await interaction.editReply(`❌ Category must be one of: ${VALID_CATEGORIES.join(', ')}`); return; }
    if (!VALID_EFFECTS.includes(effectType ?? '')) { await interaction.editReply(`❌ Effect type must be one of: ${VALID_EFFECTS.join(', ')}`); return; }

    const existing = ShopItemDB.findByKey(itemKey);
    if (existing) { await interaction.editReply(`❌ Item key \`${itemKey}\` already exists.`); return; }

    const created = ShopItemDB.create({
      item_key: itemKey,
      name: name!,
      description,
      category: category!,
      rarity: rarity!,
      price,
      icon: icon ?? '📦',
      effect_type: effectType!,
      effect_value: effectValue,
      effect_duration: effectDuration,
    });

    await interaction.editReply(`✅ **${created.name}** added to the shop. Key: \`${created.item_key}\` — Price: $${price.toLocaleString()}`);
  } catch (err) {
    logger.error('Add item modal error:', err);
    await interaction.editReply('❌ Failed to add item. Check formatting: `Name | Price | Rarity | Category | Icon`');
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   EDIT PRICE MODAL HANDLER
───────────────────────────────────────────────────────────────────────── */

async function handleEditPriceModal(interaction: ModalSubmitInteraction, itemId: string): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const item = ShopItemDB.findById(itemId);
  if (!item) { await interaction.editReply('❌ Item not found.'); return; }

  const priceStr = interaction.fields.getTextInputValue('new_price').trim();
  const stockStr = interaction.fields.getTextInputValue('new_stock').trim();
  const price = parseInt(priceStr, 10);
  const stock = parseInt(stockStr, 10);

  if (isNaN(price) || price < 0) { await interaction.editReply('❌ Invalid price.'); return; }
  if (isNaN(stock) || stock < -1) { await interaction.editReply('❌ Invalid stock. Use -1 for unlimited.'); return; }

  ShopItemDB.update(itemId, { price, stock });
  await interaction.editReply(`✅ **${item.name}** updated — Price: **$${price.toLocaleString()}** | Stock: **${stock === -1 ? '∞' : stock}**`);
}

/* ─────────────────────────────────────────────────────────────────────────
   EDIT ITEM MODAL HANDLER
───────────────────────────────────────────────────────────────────────── */

async function handleEditItemModal(interaction: ModalSubmitInteraction, itemId: string): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const item = ShopItemDB.findById(itemId);
  if (!item) { await interaction.editReply('❌ Item not found.'); return; }

  const name = interaction.fields.getTextInputValue('new_name').trim();
  const description = interaction.fields.getTextInputValue('new_description').trim();
  const rarityCategory = interaction.fields.getTextInputValue('rarity_category');
  const [rarity, category] = rarityCategory.split('|').map(s => s.trim().toLowerCase());

  const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const VALID_CATEGORIES = ['boosts', 'consumables', 'tools', 'crates', 'crew', 'special'];

  if (!name) { await interaction.editReply('❌ Name is required.'); return; }
  if (!VALID_RARITIES.includes(rarity ?? '')) { await interaction.editReply(`❌ Rarity must be one of: ${VALID_RARITIES.join(', ')}`); return; }
  if (!VALID_CATEGORIES.includes(category ?? '')) { await interaction.editReply(`❌ Category must be one of: ${VALID_CATEGORIES.join(', ')}`); return; }

  ShopItemDB.update(itemId, { name, description, rarity: rarity as ShopItem['rarity'], category });
  await interaction.editReply(`✅ **${name}** updated — Rarity: **${rarity}** | Category: **${category}**`);
}
