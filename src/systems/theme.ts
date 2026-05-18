/* ─────────────────────────────────────────────────────────────────────────
   DYNAMIC THEME ENGINE
   Controls embed colors, atmospheric text, gradient hints, and world state.

   Auto-selects theme based on: date, day-of-week, active world events.
   Admin can override at runtime via ThemeEngine.setOverride(id).

   Usage:
     const theme = ThemeEngine.getActive();
     embed.setColor(theme.primaryColor);
     const flavor = theme.randomAtmosphere();
───────────────────────────────────────────────────────────────────────── */

import { logger } from '../utils/logger.js';

/* ── Types ────────────────────────────────────────────────────────────── */

export type ThemeId =
  | 'DEFAULT_CRIMINAL'
  | 'NIGHT_OPS'
  | 'BLACK_MARKET'
  | 'POLICE_LOCKDOWN'
  | 'HEAT_WAVE'
  | 'RAINY_OPERATIONS'
  | 'BLOOD_MONEY'
  | 'CHRISTMAS_HEIST'
  | 'RAMADAN_NIGHTS'
  | 'DOUBLE_XP_WEEKEND';

export interface Theme {
  id: ThemeId;
  name: string;
  primaryColor: number;
  dangerColor: number;
  gradientA: string;
  gradientB: string;
  emoji: string;
  footerSuffix: string;
  atmosphere: readonly string[];
  rewardEmoji: string;
  alertPrefix: string;
  xpMultiplier: number;
  coinMultiplier: number;
  randomAtmosphere(): string;
}

/* ── Theme Definitions ────────────────────────────────────────────────── */

function makeTheme(base: Omit<Theme, 'randomAtmosphere'>): Theme {
  return {
    ...base,
    randomAtmosphere(): string {
      const arr = this.atmosphere;
      return arr[Math.floor(Math.random() * arr.length)] as string;
    },
  };
}

export const THEMES: Record<ThemeId, Theme> = {
  DEFAULT_CRIMINAL: makeTheme({
    id: 'DEFAULT_CRIMINAL',
    name: 'Los Santos Underground',
    primaryColor: 0xC8A951,
    dangerColor: 0xFF4757,
    gradientA: '#1a1a2e',
    gradientB: '#16213e',
    emoji: '💀',
    footerSuffix: '',
    rewardEmoji: '⚡',
    alertPrefix: '🔴',
    xpMultiplier: 1.0,
    coinMultiplier: 1.0,
    atmosphere: [
      'Another night in Los Santos. Money never sleeps.',
      'The streets never forget who runs them.',
      'Operations complete. The city bows to no one.',
      'In the underworld, reputation is everything.',
      'Los Santos — where fortune favors the ruthless.',
      'Stay off the radar. Stay alive.',
      'Another job done. The city pays its respects.',
    ],
  }),

  NIGHT_OPS: makeTheme({
    id: 'NIGHT_OPS',
    name: 'Night Operations',
    primaryColor: 0x3498DB,
    dangerColor: 0xFF4757,
    gradientA: '#0f0c29',
    gradientB: '#302b63',
    emoji: '🌙',
    footerSuffix: '• NIGHT OPS ACTIVE',
    rewardEmoji: '🌙',
    alertPrefix: '🔵',
    xpMultiplier: 1.0,
    coinMultiplier: 1.0,
    atmosphere: [
      'Darkness is an ally. Move quietly.',
      'The city sleeps. We operate.',
      'Visibility zero. Precision maximum.',
      'Night vision on. Let\'s move.',
      'The shadows belong to the professionals.',
      'After midnight — the real operators come out.',
    ],
  }),

  BLACK_MARKET: makeTheme({
    id: 'BLACK_MARKET',
    name: 'Black Market Surge',
    primaryColor: 0x9B59B6,
    dangerColor: 0xE74C3C,
    gradientA: '#1a0038',
    gradientB: '#2d0057',
    emoji: '🕶️',
    footerSuffix: '• BLACK MARKET ACTIVE',
    rewardEmoji: '🕶️',
    alertPrefix: '🟣',
    xpMultiplier: 1.0,
    coinMultiplier: 1.15,
    atmosphere: [
      'The market is hot tonight. No questions asked.',
      'Contraband moves fast when demand is high.',
      'Buyers are ready. Sellers make the rules.',
      'Underground economy — no taxes, no mercy.',
      'Every item has a price. Every deal has a cost.',
      'The black market never closes.',
    ],
  }),

  POLICE_LOCKDOWN: makeTheme({
    id: 'POLICE_LOCKDOWN',
    name: 'Police Lockdown',
    primaryColor: 0xE74C3C,
    dangerColor: 0xFF0000,
    gradientA: '#2c0000',
    gradientB: '#4a0000',
    emoji: '🚨',
    footerSuffix: '• ⚠️ POLICE LOCKDOWN',
    rewardEmoji: '🚨',
    alertPrefix: '🚨',
    xpMultiplier: 1.25,
    coinMultiplier: 0.85,
    atmosphere: [
      '🚨 All units mobilized. Heat is at maximum.',
      'Wanted levels up across the city. Watch your back.',
      'The feds are watching every move. Stay clean.',
      'Roadblocks on every freeway. Use the back routes.',
      'Six stars. Every cop in the state is after us.',
      'BOLO issued citywide. Operations are high-risk.',
    ],
  }),

  HEAT_WAVE: makeTheme({
    id: 'HEAT_WAVE',
    name: 'Heat Wave',
    primaryColor: 0xE67E22,
    dangerColor: 0xFF6B35,
    gradientA: '#3d1c00',
    gradientB: '#6b2f00',
    emoji: '🔥',
    footerSuffix: '• 🔥 HEAT WAVE',
    rewardEmoji: '🔥',
    alertPrefix: '🔥',
    xpMultiplier: 1.1,
    coinMultiplier: 1.1,
    atmosphere: [
      '🔥 The city is burning tonight.',
      'Heat rising. Tensions higher.',
      'Hot weather, hotter deals.',
      'The pavement melts. The hustle doesn\'t.',
      'Summer in Los Santos — pressure never stops.',
      'Everything is turned up. Stay cool or burn.',
    ],
  }),

  RAINY_OPERATIONS: makeTheme({
    id: 'RAINY_OPERATIONS',
    name: 'Rainy Operations',
    primaryColor: 0x1ABC9C,
    dangerColor: 0xE74C3C,
    gradientA: '#0d1b2a',
    gradientB: '#1b2838',
    emoji: '🌧️',
    footerSuffix: '• 🌧️ STORM FRONT',
    rewardEmoji: '🌧️',
    alertPrefix: '⚡',
    xpMultiplier: 1.0,
    coinMultiplier: 1.0,
    atmosphere: [
      'Rain covers the sound of footsteps.',
      'Storm rolling in. Perfect cover for operations.',
      'Wet streets, clean getaways.',
      'The rain doesn\'t stop the grind.',
      'Thunder in the distance. Lightning in your veins.',
      'Visibility low. Perfect for moving unseen.',
    ],
  }),

  BLOOD_MONEY: makeTheme({
    id: 'BLOOD_MONEY',
    name: 'Blood Money',
    primaryColor: 0xC0392B,
    dangerColor: 0xFF0000,
    gradientA: '#1a0000',
    gradientB: '#2d0000',
    emoji: '🩸',
    footerSuffix: '• 🩸 BLOOD MONEY ACTIVE',
    rewardEmoji: '🩸',
    alertPrefix: '💀',
    xpMultiplier: 1.2,
    coinMultiplier: 1.2,
    atmosphere: [
      'Blood money never washes off.',
      'High risk, high reward. No guarantees.',
      'The most dangerous contracts are the most profitable.',
      'Pay in cash. No paper trail. No witnesses.',
      'Some jobs leave marks. These leave scars.',
      'Loyalty costs. Betrayal costs more.',
    ],
  }),

  CHRISTMAS_HEIST: makeTheme({
    id: 'CHRISTMAS_HEIST',
    name: 'Christmas Heist',
    primaryColor: 0x2ECC71,
    dangerColor: 0xE74C3C,
    gradientA: '#0d2b0d',
    gradientB: '#1a4a1a',
    emoji: '🎄',
    footerSuffix: '• 🎄 CHRISTMAS HEIST',
    rewardEmoji: '🎁',
    alertPrefix: '🎄',
    xpMultiplier: 1.15,
    coinMultiplier: 1.15,
    atmosphere: [
      '🎄 Santa\'s on the naughty list — so are we.',
      'Deck the halls with stolen cash.',
      'Season\'s greetings from the underworld.',
      'The best gifts are the ones you take.',
      'Winter operations. Warm pockets.',
      'Even criminals celebrate. Just differently.',
    ],
  }),

  RAMADAN_NIGHTS: makeTheme({
    id: 'RAMADAN_NIGHTS',
    name: 'Ramadan Nights',
    primaryColor: 0x8E44AD,
    dangerColor: 0xE74C3C,
    gradientA: '#1a0033',
    gradientB: '#2d0052',
    emoji: '🌙',
    footerSuffix: '• 🌙 رمضان كريم',
    rewardEmoji: '✨',
    alertPrefix: '🌙',
    xpMultiplier: 1.0,
    coinMultiplier: 1.0,
    atmosphere: [
      '🌙 ليالي رمضان — الليل للعمليات.',
      'The crescent rises. The operation begins.',
      'Night is sacred. The mission is not.',
      'Under the Ramadan moon, we move.',
      'Blessed nights carry the heaviest operations.',
      'The stars witness tonight\'s work.',
    ],
  }),

  DOUBLE_XP_WEEKEND: makeTheme({
    id: 'DOUBLE_XP_WEEKEND',
    name: 'Double XP Weekend',
    primaryColor: 0x2ECC71,
    dangerColor: 0xE74C3C,
    gradientA: '#002200',
    gradientB: '#003300',
    emoji: '⚡',
    footerSuffix: '• ⚡ DOUBLE XP WEEKEND',
    rewardEmoji: '⚡',
    alertPrefix: '⚡',
    xpMultiplier: 2.0,
    coinMultiplier: 1.0,
    atmosphere: [
      '⚡ Double XP active. Grind starts NOW.',
      'Weekend bonuses are live. Don\'t waste it.',
      'Every operation counts double this weekend.',
      'XP multiplier maxed. Get to work.',
      'Limited time. Unlimited potential.',
      'The grind never stops — but tonight it pays double.',
    ],
  }),
};

/* ── Active Theme State ───────────────────────────────────────────────── */

let _override: ThemeId | null = null;

function detectAutoTheme(): ThemeId {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day   = now.getDate();
  const dow   = now.getDay(); // 0=Sun, 6=Sat

  // Christmas: Dec 20 – Jan 2
  if ((month === 12 && day >= 20) || (month === 1 && day <= 2)) {
    return 'CHRISTMAS_HEIST';
  }

  // Double XP: Saturdays and Sundays
  if (dow === 0 || dow === 6) {
    return 'DOUBLE_XP_WEEKEND';
  }

  return 'DEFAULT_CRIMINAL';
}

/* ── Public API ───────────────────────────────────────────────────────── */

export const ThemeEngine = {
  /** Get the currently active theme. */
  getActive(): Theme {
    const id = _override ?? detectAutoTheme();
    return THEMES[id];
  },

  /** Get a specific theme by ID. */
  get(id: ThemeId): Theme {
    return THEMES[id];
  },

  /** Admin: manually override the active theme. Pass null to revert to auto. */
  setOverride(id: ThemeId | null): void {
    _override = id;
    if (id) {
      logger.info(`[ThemeEngine] Theme override set: ${id} — "${THEMES[id].name}"`);
    } else {
      logger.info('[ThemeEngine] Theme override cleared — reverting to auto-detect');
    }
  },

  /** Returns the current override (null = auto). */
  getOverride(): ThemeId | null {
    return _override;
  },

  /** All theme IDs for use in admin select menus. */
  allIds(): ThemeId[] {
    return Object.keys(THEMES) as ThemeId[];
  },

  /** Returns a themed separator line for embeds. */
  separator(theme?: Theme): string {
    const t = theme ?? this.getActive();
    return `${t.emoji}${'─'.repeat(28)}${t.emoji}`;
  },

  /** Returns a cinematic reward string. */
  rewardLine(xp: number, coins: number, theme?: Theme): string {
    const t = theme ?? this.getActive();
    const xpStr    = xp    > 0 ? `+${xp.toLocaleString()} XP`    : '';
    const coinStr  = coins > 0 ? `+${coins.toLocaleString()} 💰`  : '';
    const parts    = [xpStr, coinStr].filter(Boolean).join('  ·  ');
    return parts ? `${t.rewardEmoji} ${parts}` : '';
  },
};
