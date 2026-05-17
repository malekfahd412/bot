export const SHOP_CATEGORIES = {
  boosts:      { key: 'boosts',      name: 'XP & Coin Boosts',  icon: '⚡', description: 'Multipliers that stack your gains during active sessions.' },
  consumables: { key: 'consumables', name: 'Consumables',        icon: '🧪', description: 'One-time use items with powerful immediate effects.' },
  tools:       { key: 'tools',       name: 'Heist Tools',        icon: '🔧', description: 'Professional-grade equipment for cleaner jobs.' },
  crates:      { key: 'crates',      name: 'Loot Crates',        icon: '📦', description: 'Gamble for random rewards. High risk, high reward.' },
  crew:        { key: 'crew',        name: 'Crew Items',         icon: '🏴', description: 'Boost your crew\'s operations and territory control.' },
  special:     { key: 'special',     name: 'Black Market',       icon: '🖤', description: 'Exclusive items not found anywhere else.' },
} as const;

export type ShopCategory = keyof typeof SHOP_CATEGORIES;

export const RARITY_CONFIG = {
  common:    { name: 'COMMON',    color: 0x8B8FA8 as number, icon: '⬜', border: '▣', label: '▣ Common' },
  uncommon:  { name: 'UNCOMMON',  color: 0x00D26A as number, icon: '🟩', border: '◈', label: '◈ Uncommon' },
  rare:      { name: 'RARE',      color: 0x3498DB as number, icon: '🟦', border: '⬢', label: '⬢ Rare' },
  epic:      { name: 'EPIC',      color: 0x9B59B6 as number, icon: '🟪', border: '✦', label: '✦ Epic' },
  legendary: { name: 'LEGENDARY', color: 0xC8A951 as number, icon: '🟨', border: '✹', label: '✹ Legendary' },
} as const;

export type Rarity = keyof typeof RARITY_CONFIG;

export const EFFECT_TYPE_LABELS: Record<string, string> = {
  XP_BOOST:       '⚡ XP Multiplier',
  COIN_BOOST:     '💰 Coin Multiplier',
  HEAT_REDUCTION: '🧊 Heat Reduction',
  HEIST_TOOL:     '🔧 Heist Bonus',
  LUCKY_CHARM:    '🍀 Lucky Bonus',
  CREW_BOOST:     '🏴 Crew Boost',
  LOOT_CRATE:     '📦 Random Reward',
  NONE:           '—',
};

export const STARTER_ITEMS: {
  item_key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  price: number;
  icon: string;
  effect_type: string;
  effect_value: number;
  effect_duration: number;
}[] = [
  {
    item_key: 'xp_boost_s',
    name: 'XP Booster I',
    description: 'Double all XP gains for 1 hour. Perfect for a focused grind session before a big heist.',
    category: 'boosts', rarity: 'uncommon', price: 2500, icon: '⚡',
    effect_type: 'XP_BOOST', effect_value: 2.0, effect_duration: 60,
  },
  {
    item_key: 'xp_boost_l',
    name: 'XP Booster II',
    description: 'Triple XP gains for 3 full hours. Used by the most ruthless operators in Los Santos.',
    category: 'boosts', rarity: 'rare', price: 7500, icon: '⚡',
    effect_type: 'XP_BOOST', effect_value: 3.0, effect_duration: 180,
  },
  {
    item_key: 'coin_boost_s',
    name: 'Money Bag I',
    description: '+50% coin gains for 1 hour. Stack that paper while the heat is low.',
    category: 'boosts', rarity: 'uncommon', price: 3000, icon: '💰',
    effect_type: 'COIN_BOOST', effect_value: 1.5, effect_duration: 60,
  },
  {
    item_key: 'coin_boost_l',
    name: 'Money Bag II',
    description: 'Double all coin gains for 3 hours. Make it rain, then disappear.',
    category: 'boosts', rarity: 'rare', price: 9000, icon: '💰',
    effect_type: 'COIN_BOOST', effect_value: 2.0, effect_duration: 180,
  },
  {
    item_key: 'heat_reducer',
    name: 'Heat Suppressor',
    description: 'Instantly clears 50 points of territory heat. Keeps you off the radar when things get too hot.',
    category: 'consumables', rarity: 'common', price: 1500, icon: '🧊',
    effect_type: 'HEAT_REDUCTION', effect_value: 50, effect_duration: 0,
  },
  {
    item_key: 'lucky_charm',
    name: "Lucky Rabbit's Foot",
    description: '+25% bonus coins on your next heist completion. Luck is just skill with better marketing.',
    category: 'consumables', rarity: 'uncommon', price: 2000, icon: '🍀',
    effect_type: 'LUCKY_CHARM', effect_value: 25, effect_duration: 120,
  },
  {
    item_key: 'heist_tool_b',
    name: 'Lockpick Set',
    description: 'Grants a +10% XP bonus on your next heist approval. A criminal\'s best friend.',
    category: 'tools', rarity: 'common', price: 4000, icon: '🔑',
    effect_type: 'HEIST_TOOL', effect_value: 10, effect_duration: 240,
  },
  {
    item_key: 'heist_tool_p',
    name: 'Thermal Drill',
    description: '+25% XP and coins on approved heists for 6 hours. The tool of choice for bank jobs.',
    category: 'tools', rarity: 'epic', price: 15000, icon: '🔧',
    effect_type: 'HEIST_TOOL', effect_value: 25, effect_duration: 360,
  },
  {
    item_key: 'crate_common',
    name: 'Common Crate',
    description: 'Contains a random Common or Uncommon item from the marketplace. Take your chances.',
    category: 'crates', rarity: 'common', price: 1000, icon: '📦',
    effect_type: 'LOOT_CRATE', effect_value: 1, effect_duration: 0,
  },
  {
    item_key: 'crate_rare',
    name: 'Rare Crate',
    description: 'Contains a random Rare or Epic item. Only for those who gamble with conviction.',
    category: 'crates', rarity: 'rare', price: 5000, icon: '🎁',
    effect_type: 'LOOT_CRATE', effect_value: 2, effect_duration: 0,
  },
  {
    item_key: 'crew_boost',
    name: 'Crew Reputation Booster',
    description: '+50% crew reputation gains for 2 hours. Show the city who runs these streets.',
    category: 'crew', rarity: 'rare', price: 8000, icon: '🏴',
    effect_type: 'CREW_BOOST', effect_value: 50, effect_duration: 120,
  },
  {
    item_key: 'kingpin_pass',
    name: "Kingpin's Pass",
    description: 'The ultimate power move. Triple XP gains for 1 hour. Reserved for the top tier.',
    category: 'special', rarity: 'legendary', price: 50000, icon: '👑',
    effect_type: 'XP_BOOST', effect_value: 3.0, effect_duration: 60,
  },
];

export function getDailyFeaturedKeys(items: { item_key: string }[]): string[] {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const available = items.map(i => i.item_key);
  const picked: string[] = [];
  let s = seed;
  while (picked.length < Math.min(3, available.length)) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const idx = s % available.length;
    const key = available[idx];
    if (!picked.includes(key)) picked.push(key);
  }
  return picked;
}

export const DAILY_DISCOUNT = 0.10;
