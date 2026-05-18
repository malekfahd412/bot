import { EmbedBuilder } from 'discord.js';
import { ShopItem, InventoryItem, ActiveBoost, Player } from '../database/schema.js';
import { SHOP_CATEGORIES, RARITY_CONFIG, EFFECT_TYPE_LABELS, getDailyFeaturedKeys, DAILY_DISCOUNT } from './items-config.js';
import { formatCoins } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';

const LINE = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

function rarityOf(item: ShopItem) {
  return RARITY_CONFIG[item.rarity as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.common;
}

function fmtDuration(minutes: number): string {
  if (minutes <= 0) return 'Instant';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function buildMainEmbed(player: Player, allItems: ShopItem[], lang = 'en'): EmbedBuilder {
  const featured = getDailyFeaturedKeys(allItems);
  const featuredItems = featured.map(k => allItems.find(i => i.item_key === k)).filter(Boolean) as ShopItem[];
  const discount = Math.round(1000 * DAILY_DISCOUNT);

  const featuredLines = featuredItems.map(item => {
    const r = rarityOf(item);
    const discounted = Math.floor(item.price * (1 - DAILY_DISCOUNT));
    return `${r.icon} **${item.icon} ${item.name}** — ~~${formatCoins(item.price)}~~ **${formatCoins(discounted)}** *(−${discount / 10}%)*`;
  }).join('\n') || t(lang, 'shop.embeds.main.no_featured');

  return new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(t(lang, 'shop.embeds.main.title'))
    .setDescription(
      `*${t(lang, 'shop.embeds.main.quote')}*\n${LINE}\n\n` +
      `${t(lang, 'shop.embeds.main.featured_header')}\n${featuredLines}\n\n${LINE}`
    )
    .addFields(
      { name: t(lang, 'shop.embeds.main.balance_field'),    value: `**${formatCoins(player.coins)}**`, inline: true },
      { name: t(lang, 'shop.embeds.main.categories_field'), value: Object.values(SHOP_CATEGORIES).map(c => `${c.icon} ${c.name}`).join('\n'), inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
    )
    .setFooter({ text: t(lang, 'shop.embeds.main.footer') })
    .setTimestamp();
}

export function buildCategoryEmbed(
  category: keyof typeof SHOP_CATEGORIES,
  items: ShopItem[],
  page: number,
  totalPages: number,
  player: Player,
  lang = 'en',
): EmbedBuilder {
  const cat = SHOP_CATEGORIES[category];
  const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  const sorted = [...items].sort((a, b) => (rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 0) - (rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 0));

  const lines = sorted.map(item => {
    const r = rarityOf(item);
    const stock = item.stock === -1 ? '' : item.stock === 0 ? ` *(${t(lang, 'shop.embeds.item_detail.stock_out')})*` : ` *(${item.stock} left)*`;
    const avail = item.available ? '' : ' 🔒';
    return `${r.icon} **${item.icon} ${item.name}**${avail}${stock}\n> ${r.label} • ${formatCoins(item.price)}\n> *${item.description.slice(0, 80)}${item.description.length > 80 ? '…' : ''}*`;
  }).join('\n\n') || t(lang, 'shop.embeds.category.no_items');

  return new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(`${cat.icon}  ${cat.name.toUpperCase()}`)
    .setDescription(`*${cat.description}*\n${LINE}\n\n${lines}\n\n${LINE}`)
    .addFields(
      { name: t(lang, 'shop.embeds.category.balance_field'), value: formatCoins(player.coins), inline: true },
      { name: t(lang, 'shop.embeds.category.items_field'),   value: `${items.length}`, inline: true },
      { name: t(lang, 'shop.embeds.category.page_field'),    value: `${page + 1} / ${totalPages}`, inline: true },
    )
    .setFooter({ text: t(lang, 'shop.embeds.category.footer') })
    .setTimestamp();
}

export function buildItemDetailEmbed(item: ShopItem, player: Player, lang = 'en'): EmbedBuilder {
  const r = rarityOf(item);
  const effectLabel = EFFECT_TYPE_LABELS[item.effect_type] ?? item.effect_type;
  const effectStr = item.effect_type === 'XP_BOOST' || item.effect_type === 'COIN_BOOST'
    ? `×${item.effect_value} multiplier`
    : item.effect_type === 'HEAT_REDUCTION' || item.effect_type === 'LUCKY_CHARM' || item.effect_type === 'HEIST_TOOL' || item.effect_type === 'CREW_BOOST'
      ? `+${item.effect_value}%`
      : item.effect_type === 'LOOT_CRATE'
        ? item.effect_value >= 2 ? 'Rare / Epic reward' : 'Common / Uncommon reward'
        : String(item.effect_value);

  const canAfford = player.coins >= item.price;
  const stockLine = item.stock === -1
    ? t(lang, 'shop.embeds.item_detail.stock_unlimited')
    : item.stock === 0
      ? t(lang, 'shop.embeds.item_detail.stock_out')
      : t(lang, 'shop.embeds.item_detail.stock_remaining', { count: String(item.stock) });

  const balanceLine = canAfford
    ? t(lang, 'shop.embeds.item_detail.balance_ok',  { balance: formatCoins(player.coins) })
    : t(lang, 'shop.embeds.item_detail.balance_no',  { balance: formatCoins(player.coins) });

  return new EmbedBuilder()
    .setColor(r.color)
    .setTitle(`${item.icon}  ${item.name}`)
    .setDescription(
      `${r.border.repeat(28)}\n\n${item.description}\n\n${r.border.repeat(28)}`
    )
    .addFields(
      { name: t(lang, 'shop.embeds.item_detail.rarity_field'),   value: r.label,                inline: true },
      { name: t(lang, 'shop.embeds.item_detail.price_field'),    value: formatCoins(item.price), inline: true },
      { name: t(lang, 'shop.embeds.item_detail.stock_field'),    value: stockLine,               inline: true },
      { name: effectLabel,                                       value: effectStr,               inline: true },
      { name: t(lang, 'shop.embeds.item_detail.duration_field'), value: fmtDuration(item.effect_duration), inline: true },
      { name: t(lang, 'shop.embeds.item_detail.balance_field'),  value: balanceLine,             inline: true },
    )
    .setFooter({ text: canAfford
      ? t(lang, 'shop.embeds.item_detail.can_afford')
      : t(lang, 'shop.embeds.item_detail.cannot_afford', { amount: formatCoins(item.price - player.coins) })
    })
    .setTimestamp();
}

export function buildInventoryEmbed(
  items: InventoryItem[],
  boosts: ActiveBoost[],
  player: Player,
  page: number,
  totalPages: number,
  lang = 'en',
): EmbedBuilder {
  const PAGE_SIZE = 6;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const itemLines = slice.map(inv =>
    `${inv.item_icon} **${inv.item_name}** ×${inv.quantity}\n> *Acquired <t:${Math.floor(new Date(inv.acquired_at).getTime() / 1000)}:R>*`
  ).join('\n\n') || t(lang, 'shop.embeds.inventory.empty');

  const now = Date.now();
  const activeLines = boosts.filter(b => new Date(b.expires_at).getTime() > now).map(b => {
    const exp = Math.floor(new Date(b.expires_at).getTime() / 1000);
    return `${b.item_icon} **${b.item_name}** — expires <t:${exp}:R>`;
  }).join('\n') || t(lang, 'shop.embeds.inventory.no_boosts');

  return new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle(t(lang, 'shop.embeds.inventory.title', { name: player.display_name.toUpperCase() }))
    .setDescription(
      `*${t(lang, 'shop.embeds.inventory.subtitle')}*\n${LINE}\n\n` +
      `**${t(lang, 'shop.embeds.inventory.inventory_header')}** (${items.length} items)\n${itemLines}\n\n${LINE}\n\n` +
      `**${t(lang, 'shop.embeds.inventory.boosts_header')}**\n${activeLines}`
    )
    .addFields(
      { name: t(lang, 'shop.embeds.inventory.balance_field'), value: formatCoins(player.coins), inline: true },
      { name: t(lang, 'shop.embeds.inventory.page_field'),    value: `${page + 1} / ${Math.max(1, totalPages)}`, inline: true },
    )
    .setFooter({ text: t(lang, 'shop.embeds.inventory.footer') })
    .setTimestamp();
}

export function buildFeaturedEmbed(featuredItems: ShopItem[], player: Player, lang = 'en'): EmbedBuilder {
  const lines = featuredItems.map(item => {
    const r = rarityOf(item);
    const discounted = Math.floor(item.price * (1 - DAILY_DISCOUNT));
    const effectLabel = EFFECT_TYPE_LABELS[item.effect_type] ?? item.effect_type;
    const effectStr = item.effect_type === 'XP_BOOST' || item.effect_type === 'COIN_BOOST'
      ? `×${item.effect_value}`
      : `+${item.effect_value}${item.effect_type === 'LOOT_CRATE' ? '' : '%'}`;

    return [
      `${r.icon} **${item.icon} ${item.name}** — ${r.label}`,
      `> ~~${formatCoins(item.price)}~~ → **${formatCoins(discounted)}** *(−10% ${t(lang, 'shop.embeds.featured.discount_note')})*`,
      `> ${effectLabel}: **${effectStr}** • ${item.effect_duration > 0 ? fmtDuration(item.effect_duration) : 'Instant'}`,
    ].join('\n');
  }).join('\n\n') || t(lang, 'shop.embeds.featured.no_items');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(t(lang, 'shop.embeds.featured.title'))
    .setDescription(
      `*${t(lang, 'shop.embeds.featured.subtitle')}*\n${LINE}\n\n${lines}\n\n${LINE}`
    )
    .addFields(
      { name: t(lang, 'shop.embeds.featured.balance_field'), value: formatCoins(player.coins), inline: true },
      { name: t(lang, 'shop.embeds.featured.resets_field'),  value: '<t:' + getNextMidnightTs() + ':R>', inline: true },
    )
    .setFooter({ text: t(lang, 'shop.embeds.featured.footer') })
    .setTimestamp();
}

function getNextMidnightTs(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function buildPurchaseSuccessEmbed(item: ShopItem, player: Player, lang = 'en'): EmbedBuilder {
  const r = rarityOf(item);
  return new EmbedBuilder()
    .setColor(0x00D26A)
    .setTitle(t(lang, 'shop.embeds.purchase_success.title'))
    .setDescription(
      `${LINE}\n\n${item.icon} ${t(lang, 'shop.embeds.purchase_success.body', { name: item.name })}\n\n${LINE}`
    )
    .addFields(
      { name: t(lang, 'shop.embeds.purchase_success.rarity_field'),   value: r.label,                                   inline: true },
      { name: t(lang, 'shop.embeds.purchase_success.paid_field'),     value: formatCoins(item.price),                   inline: true },
      { name: t(lang, 'shop.embeds.purchase_success.remaining_field'),value: formatCoins(player.coins - item.price),    inline: true },
    )
    .setFooter({ text: t(lang, 'shop.embeds.purchase_success.footer') })
    .setTimestamp();
}

export function buildUseItemEmbed(item: InventoryItem, boost: ActiveBoost | null, crateReward: ShopItem | null, lang = 'en'): EmbedBuilder {
  if (crateReward) {
    const r = RARITY_CONFIG[crateReward.rarity as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.common;
    return new EmbedBuilder()
      .setColor(r.color)
      .setTitle(t(lang, 'shop.embeds.crate_opened.title'))
      .setDescription(
        `${LINE}\n\n${t(lang, 'shop.embeds.crate_opened.body', { crate: item.item_name })}\n\n` +
        `${r.icon} **${crateReward.icon} ${crateReward.name}**\n*${crateReward.description}*\n\n${LINE}`
      )
      .addFields({ name: t(lang, 'shop.embeds.crate_opened.rarity_field'), value: r.label, inline: true })
      .setFooter({ text: t(lang, 'shop.embeds.crate_opened.footer') })
      .setTimestamp();
  }

  if (boost) {
    const exp = Math.floor(new Date(boost.expires_at).getTime() / 1000);
    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(t(lang, 'shop.embeds.boost_activated.title'))
      .setDescription(`${LINE}\n\n${t(lang, 'shop.embeds.boost_activated.body', { icon: item.item_icon, name: item.item_name })}\n\n${LINE}`)
      .addFields(
        { name: t(lang, 'shop.embeds.boost_activated.expires_field'), value: `<t:${exp}:R> (<t:${exp}:t>)`, inline: false },
      )
      .setFooter({ text: t(lang, 'shop.embeds.boost_activated.footer') })
      .setTimestamp();
  }

  return new EmbedBuilder()
    .setColor(0x00D26A)
    .setTitle(t(lang, 'shop.embeds.item_used.title'))
    .setDescription(`${LINE}\n\n${t(lang, 'shop.embeds.item_used.body', { icon: item.item_icon, name: item.item_name })}\n\n${LINE}`)
    .setTimestamp();
}

export function buildAdminPanelEmbed(items: ShopItem[], page: number, totalPages: number, stats: { totalSold: number; topItems: { name: string; count: number }[] }): EmbedBuilder {
  const PAGE_SIZE = 5;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const itemLines = slice.map((item, i) => {
    const r = rarityOf(item);
    const statusIcon = item.available ? '🟢' : '🔴';
    const featIcon = item.featured ? '⭐' : '  ';
    return `**${page * PAGE_SIZE + i + 1}.** ${statusIcon}${featIcon} ${item.icon} **${item.name}** — ${r.label}\n> ${formatCoins(item.price)} • \`${item.item_key}\` • Stock: ${item.stock === -1 ? '∞' : item.stock}`;
  }).join('\n\n') || '*No items.*';

  const topLine = stats.topItems.length
    ? stats.topItems.map((t, i) => `${i + 1}. **${t.name}** (${t.count} sold)`).join('\n')
    : '*No sales yet.*';

  return new EmbedBuilder()
    .setColor(0xC8A951)
    .setTitle('🛠️  SHOP ADMIN PANEL')
    .setDescription(
      `*Full CRUD control for the Black Market. Tread carefully.*\n${LINE}\n\n` +
      `**📦 SHOP ITEMS** (Page ${page + 1}/${Math.max(1, totalPages)})\n${itemLines}\n\n${LINE}`
    )
    .addFields(
      { name: '📊 Total Items', value: String(items.length), inline: true },
      { name: '🛒 Total Sold',  value: String(stats.totalSold), inline: true },
      { name: '🏆 Top Items', value: topLine, inline: false },
    )
    .setFooter({ text: 'Select an item below to manage it • Use Add Item to create new entries' })
    .setTimestamp();
}

export function buildAdminItemEmbed(item: ShopItem): EmbedBuilder {
  const r = rarityOf(item);
  return new EmbedBuilder()
    .setColor(r.color)
    .setTitle(`🛠️  Managing: ${item.icon} ${item.name}`)
    .setDescription(`*Use the buttons below to modify this item.*\n${LINE}`)
    .addFields(
      { name: '🔑 Key',        value: `\`${item.item_key}\``,    inline: true },
      { name: '🏷️ Price',     value: formatCoins(item.price),   inline: true },
      { name: '✨ Rarity',    value: r.label,                   inline: true },
      { name: '📂 Category',  value: item.category,              inline: true },
      { name: '📦 Stock',     value: item.stock === -1 ? '∞' : String(item.stock), inline: true },
      { name: '🟢 Available', value: item.available ? 'Yes' : 'No', inline: true },
      { name: '⭐ Featured',  value: item.featured ? 'Yes' : 'No', inline: true },
      { name: '⚡ Effect',    value: `${EFFECT_TYPE_LABELS[item.effect_type] ?? item.effect_type} (${item.effect_value})`, inline: true },
      { name: '⏱️ Duration',  value: item.effect_duration > 0 ? `${item.effect_duration}m` : 'Instant', inline: true },
      { name: '📝 Description', value: item.description.slice(0, 300), inline: false },
    )
    .setTimestamp();
}
