import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ShopItem, InventoryItem } from '../database/schema.js';
import { SHOP_CATEGORIES, RARITY_CONFIG, getDailyFeaturedKeys, DAILY_DISCOUNT } from './items-config.js';
import { formatCoins } from '../utils/helpers.js';

type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

export function buildMainRows(): AnyRow[] {
  const cats = Object.values(SHOP_CATEGORIES);
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('shop:feat').setLabel('⭐ Daily Deals').setStyle(ButtonStyle.Success),
    ...cats.slice(0, 4).map(c =>
      new ButtonBuilder().setCustomId(`shop:cat:${c.key}:0`).setLabel(`${c.icon} ${c.name}`).setStyle(ButtonStyle.Secondary)
    ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(4).map(c =>
      new ButtonBuilder().setCustomId(`shop:cat:${c.key}:0`).setLabel(`${c.icon} ${c.name}`).setStyle(ButtonStyle.Secondary)
    ),
    new ButtonBuilder().setCustomId('shop:inv:0').setLabel('🎒 My Inventory').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}

export function buildCategoryRows(
  items: ShopItem[],
  category: string,
  page: number,
  totalPages: number,
): AnyRow[] {
  const rows: AnyRow[] = [];

  if (items.length > 0) {
    const opts = items.slice(0, 25).map(item => {
      const r = RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.common;
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${item.name}`)
        .setDescription(`${r.label} • ${formatCoins(item.price)}`)
        .setValue(item.id)
        .setEmoji(item.icon.codePointAt(0)?.toString(16) ? { name: item.icon } : { name: '📦' });
    });
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`shop_sel:item:${category}:${page}`)
          .setPlaceholder('📋 Select an item to view details...')
          .addOptions(opts),
      )
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('shop:main').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`shop:cat:${category}:${Math.max(0, page - 1)}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`shop:cat:${category}:${Math.min(totalPages - 1, page + 1)}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );
  rows.push(navRow);
  return rows;
}

export function buildItemDetailRows(item: ShopItem, canAfford: boolean, outOfStock: boolean): AnyRow[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:buy:${item.id}`)
      .setLabel(outOfStock ? '❌ Out of Stock' : `💳 Purchase — ${formatCoins(item.price)}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canAfford || outOfStock || !item.available),
    new ButtonBuilder().setCustomId(`shop:cat:${item.category}:0`).setLabel('← Back').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop:main').setLabel('🏠 Main').setStyle(ButtonStyle.Secondary),
  );
  return [row];
}

export function buildInventoryRows(items: InventoryItem[], page: number, totalPages: number): AnyRow[] {
  const rows: AnyRow[] = [];
  const PAGE_SIZE = 6;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (slice.length > 0) {
    const usable = slice.filter(i => i.item_type !== 'non_usable');
    if (usable.length > 0) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('shop_sel:use')
            .setPlaceholder('⚡ Select an item to use...')
            .addOptions(
              usable.slice(0, 25).map(inv =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${inv.item_name} ×${inv.quantity}`)
                  .setDescription(`Use this item from your stash`)
                  .setValue(inv.id)
                  .setEmoji({ name: inv.item_icon.length <= 2 ? inv.item_icon : '🎒' })
              )
            ),
        )
      );
    }
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shop:main').setLabel('🏠 Shop').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop:inv:${Math.max(0, page - 1)}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`shop:inv:${Math.min(Math.max(0, totalPages - 1), page + 1)}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
    )
  );
  return rows;
}

export function buildFeaturedRows(featuredItems: ShopItem[], playerCoins: number): AnyRow[] {
  const rows: AnyRow[] = [];
  const discountedItems = featuredItems.map(item => ({
    item,
    discountedPrice: Math.floor(item.price * (1 - DAILY_DISCOUNT)),
  }));

  if (discountedItems.length > 0) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...discountedItems.slice(0, 3).map(({ item, discountedPrice }) =>
          new ButtonBuilder()
            .setCustomId(`shop:buyfeat:${item.id}`)
            .setLabel(`${item.icon} Buy — ${formatCoins(discountedPrice)}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(playerCoins < discountedPrice || !item.available)
        )
      )
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shop:main').setLabel('← Back to Shop').setStyle(ButtonStyle.Secondary),
    )
  );
  return rows;
}

export function buildAdminPanelRows(items: ShopItem[], page: number, totalPages: number): AnyRow[] {
  const rows: AnyRow[] = [];
  const PAGE_SIZE = 5;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopadm:add').setLabel('➕ Add Item').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`shopadm:panel:${Math.max(0, page - 1)}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`shopadm:panel:${Math.min(Math.max(0, totalPages - 1), page + 1)}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
    )
  );

  if (slice.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`shopadm_sel:item:${page}`)
          .setPlaceholder('🛠️ Select an item to manage...')
          .addOptions(
            slice.map(item =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name}`)
                .setDescription(`${item.available ? '🟢' : '🔴'} ${item.rarity} • ${formatCoins(item.price)}`)
                .setValue(item.id)
            )
          )
      )
    );
  }

  return rows;
}

export function buildAdminItemRows(itemId: string, page: number): AnyRow[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopadm:edit_price:${itemId}`).setLabel('✏️ Edit Price').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shopadm:edit_item:${itemId}`).setLabel('📝 Edit Item').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shopadm:toggle_avail:${itemId}`).setLabel('🔄 Toggle Available').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shopadm:toggle_feat:${itemId}`).setLabel('⭐ Toggle Featured').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopadm:delete:${itemId}`).setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`shopadm:panel:${page}`).setLabel('← Back').setStyle(ButtonStyle.Secondary),
    ),
  ];
}
