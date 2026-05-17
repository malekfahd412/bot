import {
  ButtonInteraction, StringSelectMenuInteraction,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { ShopItemDB } from '../database/db.js';
import { buildAdminPanelEmbed, buildAdminItemEmbed } from '../shop-ui/embeds.js';
import { buildAdminPanelRows, buildAdminItemRows } from '../shop-ui/buttons.js';
import { logger } from '../utils/logger.js';

const PAGE_SIZE = 5;

function isAdmin(interaction: ButtonInteraction | StringSelectMenuInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export async function showAdminPanel(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  page: number,
): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const allItems = ShopItemDB.getAll();
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const stats = ShopItemDB.getAnalytics();

  const embed = buildAdminPanelEmbed(allItems, safePage, totalPages, stats);
  const rows = buildAdminPanelRows(allItems, safePage, totalPages);

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    await interaction.update({ embeds: [embed], components: rows });
  }
}

export async function showAdminItem(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  itemId: string,
  page: number,
): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const item = ShopItemDB.findById(itemId);
  if (!item) {
    await interaction.update({ content: '❌ Item not found.', embeds: [], components: [] });
    return;
  }

  const embed = buildAdminItemEmbed(item);
  const rows = buildAdminItemRows(itemId, page);

  await interaction.update({ embeds: [embed], components: rows });
}

export async function showAddItemModal(interaction: ButtonInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('shop_mod:add_item')
    .setTitle('➕ Add Shop Item');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('item_key').setLabel('Item Key (unique, no spaces)')
        .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder('e.g. xp_boost_xl')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name_price_rarity').setLabel('Name | Price | Rarity | Category | Icon')
        .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Mega Boost | 25000 | epic | boosts | ⚡')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Description')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('effect_type_value').setLabel('Effect Type | Effect Value | Duration (mins)')
        .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('XP_BOOST | 2.0 | 60')
    ),
  );

  await interaction.showModal(modal);
}

export async function showEditPriceModal(interaction: ButtonInteraction, itemId: string): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const item = ShopItemDB.findById(itemId);
  if (!item) { await interaction.reply({ content: '❌ Item not found.', ephemeral: true }); return; }

  const modal = new ModalBuilder()
    .setCustomId(`shop_mod:edit_price:${itemId}`)
    .setTitle(`✏️ Edit Price — ${item.name}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('new_price').setLabel('New Price (coins)')
        .setStyle(TextInputStyle.Short).setRequired(true).setValue(String(item.price)).setMaxLength(10)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('new_stock').setLabel('Stock (-1 = unlimited)')
        .setStyle(TextInputStyle.Short).setRequired(true).setValue(String(item.stock)).setMaxLength(6)
    ),
  );

  await interaction.showModal(modal);
}

export async function showEditItemModal(interaction: ButtonInteraction, itemId: string): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }

  const item = ShopItemDB.findById(itemId);
  if (!item) { await interaction.reply({ content: '❌ Item not found.', ephemeral: true }); return; }

  const modal = new ModalBuilder()
    .setCustomId(`shop_mod:edit_item:${itemId}`)
    .setTitle(`📝 Edit — ${item.name.slice(0, 30)}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('new_name').setLabel('Name')
        .setStyle(TextInputStyle.Short).setRequired(true).setValue(item.name).setMaxLength(50)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('new_description').setLabel('Description')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(item.description.slice(0, 200)).setMaxLength(200)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('rarity_category').setLabel('Rarity | Category')
        .setStyle(TextInputStyle.Short).setRequired(true).setValue(`${item.rarity} | ${item.category}`).setMaxLength(50)
    ),
  );

  await interaction.showModal(modal);
}

export async function toggleItemAvailable(interaction: ButtonInteraction, itemId: string): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }
  const nowAvailable = ShopItemDB.toggleAvailable(itemId);
  logger.info(`Admin toggled item ${itemId} available=${nowAvailable}`);
  const page = 0;
  await showAdminItem(interaction, itemId, page);
}

export async function toggleItemFeatured(interaction: ButtonInteraction, itemId: string): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }
  const nowFeatured = ShopItemDB.toggleFeatured(itemId);
  logger.info(`Admin toggled item ${itemId} featured=${nowFeatured}`);
  await showAdminItem(interaction, itemId, 0);
}

export async function deleteItem(interaction: ButtonInteraction, itemId: string): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🚫 Admin only.', ephemeral: true });
    return;
  }
  const item = ShopItemDB.findById(itemId);
  if (!item) { await interaction.update({ content: '❌ Item not found.', embeds: [], components: [] }); return; }

  ShopItemDB.delete(itemId);
  logger.info(`Admin deleted shop item: ${item.name} (${itemId})`);
  await showAdminPanel(interaction, 0);
}
