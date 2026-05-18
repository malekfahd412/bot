import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ShopItem, InventoryItem } from '../database/schema.js';
import { SHOP_CATEGORIES, RARITY_CONFIG, DAILY_DISCOUNT } from './items-config.js';
import { formatCoins } from '../utils/helpers.js';
import { createCustomId, validateComponentRows } from '../shop-utils/customId.js';
import { t } from '../utils/i18n.js';

type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

/* ─────────────────────────────────────────────────────────────────────────
   REUSABLE BUTTON BUILDERS
───────────────────────────────────────────────────────────────────────── */

export function createBackButton(label = '← Back', customId = 'shop:main'): ButtonBuilder {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary);
}

export function createMainButton(lang = 'en'): ButtonBuilder {
  return new ButtonBuilder().setCustomId('shop:main').setLabel(t(lang, 'shop.buttons.shop_home')).setStyle(ButtonStyle.Secondary);
}

export function createPaginationButtons(
  prefix: string,
  page: number,
  totalPages: number,
  lang = 'en',
): [ButtonBuilder, ButtonBuilder] {
  const prevPage = Math.max(0, page - 1);
  const nextPage = Math.min(totalPages - 1, page + 1);

  const prevBtn = new ButtonBuilder()
    .setCustomId(createCustomId(prefix, prevPage, 'prev'))
    .setLabel(t(lang, 'shop.buttons.prev'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);

  const nextBtn = new ButtonBuilder()
    .setCustomId(createCustomId(prefix, nextPage, 'next'))
    .setLabel(t(lang, 'shop.buttons.next'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  return [prevBtn, nextBtn];
}

export function createInventoryPaginationButtons(
  page: number,
  totalPages: number,
  lang = 'en',
): [ButtonBuilder, ButtonBuilder] {
  const prevPage = Math.max(0, page - 1);
  const nextPage = Math.min(Math.max(0, totalPages - 1), page + 1);

  const prevBtn = new ButtonBuilder()
    .setCustomId(createCustomId('shop:inv', prevPage, 'prev'))
    .setLabel(t(lang, 'shop.buttons.prev'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);

  const nextBtn = new ButtonBuilder()
    .setCustomId(createCustomId('shop:inv', nextPage, 'next'))
    .setLabel(t(lang, 'shop.buttons.next'))
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  return [prevBtn, nextBtn];
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN SHOP
───────────────────────────────────────────────────────────────────────── */

export function buildMainRows(lang = 'en'): AnyRow[] {
  const cats = Object.values(SHOP_CATEGORIES);
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('shop:feat').setLabel(t(lang, 'shop.buttons.daily_deals')).setStyle(ButtonStyle.Success),
    ...cats.slice(0, 4).map(c =>
      new ButtonBuilder().setCustomId(`shop:cat:${c.key}:0`).setLabel(`${c.icon} ${c.name}`).setStyle(ButtonStyle.Secondary)
    ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(4).map(c =>
      new ButtonBuilder().setCustomId(`shop:cat:${c.key}:0`).setLabel(`${c.icon} ${c.name}`).setStyle(ButtonStyle.Secondary)
    ),
    new ButtonBuilder().setCustomId('shop:inv:0').setLabel(t(lang, 'shop.buttons.my_inventory')).setStyle(ButtonStyle.Primary),
  );
  return validateComponentRows([row1, row2], 'buildMainRows');
}

/* ─────────────────────────────────────────────────────────────────────────
   CATEGORY
───────────────────────────────────────────────────────────────────────── */

export function buildCategoryRows(
  items: ShopItem[],
  category: string,
  page: number,
  totalPages: number,
  lang = 'en',
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
          .setPlaceholder(t(lang, 'shop.buttons.select_item'))
          .addOptions(opts),
      )
    );
  }

  const [prevBtn, nextBtn] = createPaginationButtons(`shop:cat:${category}`, page, totalPages, lang);
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    createBackButton(t(lang, 'shop.buttons.back'), 'shop:main'),
    prevBtn,
    nextBtn,
  );
  rows.push(navRow);

  return validateComponentRows(rows, `buildCategoryRows[${category}]`);
}

/* ─────────────────────────────────────────────────────────────────────────
   ITEM DETAIL
───────────────────────────────────────────────────────────────────────── */

export function buildItemDetailRows(item: ShopItem, canAfford: boolean, outOfStock: boolean, lang = 'en'): AnyRow[] {
  const purchaseLabel = outOfStock
    ? t(lang, 'shop.buttons.out_of_stock')
    : `💳 ${formatCoins(item.price)}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop:buy:${item.id}`)
      .setLabel(purchaseLabel)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canAfford || outOfStock || !item.available),
    createBackButton(t(lang, 'shop.buttons.back'), `shop:cat:${item.category}:0`),
    createMainButton(lang),
  );
  return validateComponentRows([row], 'buildItemDetailRows');
}

/* ─────────────────────────────────────────────────────────────────────────
   INVENTORY
───────────────────────────────────────────────────────────────────────── */

export function buildInventoryRows(items: InventoryItem[], page: number, totalPages: number, lang = 'en'): AnyRow[] {
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
            .setPlaceholder(t(lang, 'shop.buttons.use_placeholder'))
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

  const [prevBtn, nextBtn] = createInventoryPaginationButtons(page, totalPages, lang);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shop:main').setLabel(t(lang, 'shop.buttons.shop_home')).setStyle(ButtonStyle.Secondary),
      prevBtn,
      nextBtn,
    )
  );

  return validateComponentRows(rows, 'buildInventoryRows');
}

/* ─────────────────────────────────────────────────────────────────────────
   FEATURED
───────────────────────────────────────────────────────────────────────── */

export function buildFeaturedRows(featuredItems: ShopItem[], playerCoins: number, lang = 'en'): AnyRow[] {
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
            .setLabel(`${item.icon} ${formatCoins(discountedPrice)}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(playerCoins < discountedPrice || !item.available)
        )
      )
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      createBackButton(t(lang, 'shop.buttons.back_to_shop'), 'shop:main'),
    )
  );

  return validateComponentRows(rows, 'buildFeaturedRows');
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN PANEL
───────────────────────────────────────────────────────────────────────── */

export function buildAdminPanelRows(items: ShopItem[], page: number, totalPages: number): AnyRow[] {
  const rows: AnyRow[] = [];
  const PAGE_SIZE = 5;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const [prevBtn, nextBtn] = createPaginationButtons('shopadm:panel', page, totalPages);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shopadm:add').setLabel('➕ Add Item').setStyle(ButtonStyle.Success),
      prevBtn,
      nextBtn,
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

  return validateComponentRows(rows, 'buildAdminPanelRows');
}

export function buildAdminItemRows(itemId: string, page: number): AnyRow[] {
  const rows: AnyRow[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopadm:edit_price:${itemId}`).setLabel('✏️ Edit Price').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shopadm:edit_item:${itemId}`).setLabel('📝 Edit Item').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shopadm:toggle_avail:${itemId}`).setLabel('🔄 Toggle Available').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shopadm:toggle_feat:${itemId}`).setLabel('⭐ Toggle Featured').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`shopadm:delete:${itemId}`).setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(createCustomId('shopadm:panel', page, 'back')).setLabel('← Back').setStyle(ButtonStyle.Secondary),
    ),
  ];
  return validateComponentRows(rows, 'buildAdminItemRows');
}
