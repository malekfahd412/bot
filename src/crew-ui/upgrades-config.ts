export const CREW_UPGRADES = {
  vault_i: {
    key: 'vault_i',
    name: 'Vault Expansion I',
    description: 'Increase crew bank capacity to $100K',
    cost: 5_000,
    icon: '🔒',
    requires: null,
  },
  vault_ii: {
    key: 'vault_ii',
    name: 'Vault Expansion II',
    description: 'Increase crew bank capacity to $500K',
    cost: 25_000,
    icon: '🏦',
    requires: 'vault_i',
  },
  income_boost: {
    key: 'income_boost',
    name: 'Income Boost',
    description: '+25% passive territory income per hour',
    cost: 10_000,
    icon: '📈',
    requires: null,
  },
  crew_expansion: {
    key: 'crew_expansion',
    name: 'Crew Expansion',
    description: 'Increase max crew size to 15 members',
    cost: 15_000,
    icon: '👥',
    requires: null,
  },
  heat_reduction: {
    key: 'heat_reduction',
    name: 'Clean Money',
    description: 'Reduce territory contest cooldown by 30%',
    cost: 12_000,
    icon: '🧹',
    requires: null,
  },
  fortification: {
    key: 'fortification',
    name: 'Fortification',
    description: 'Territory defense strength +50%',
    cost: 20_000,
    icon: '🛡️',
    requires: 'income_boost',
  },
} as const;

export type UpgradeKey = keyof typeof CREW_UPGRADES;
