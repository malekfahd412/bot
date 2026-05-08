export const COLORS = {
  primary: '#C8A951',
  secondary: '#1A1A2E',
  accent: '#E94560',
  success: '#00D26A',
  danger: '#FF4757',
  warning: '#FFA502',
  background: '#0B0F1A',
  surface: '#141824',
  surfaceAlt: '#1A1F2E',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  gold: '#FFD700',
  xpBar: '#00D26A',
  xpBarBg: '#2A2F45',
} as const;

export const DIFFICULTY_CONFIG = {
  easy: {
    label: 'EASY',
    xp: 150,
    coins: 1200,
    color: '#00D26A',
    multiplier: 1.0,
  },

  normal: {
    label: 'NORMAL',
    xp: 350,
    coins: 3000,
    color: '#FFA502',
    multiplier: 1.5,
  },

  hard: {
    label: 'HARD',
    xp: 700,
    coins: 6500,
    color: '#FF4757',
    multiplier: 2.2,
  },
} as const;

export type Difficulty = keyof typeof DIFFICULTY_CONFIG;

export const RANK_THRESHOLDS = [
  { name: 'CIVILIAN', minLevel: 1, color: '#8B8FA8', icon: '👤' },
  { name: 'ASSOCIATE', minLevel: 5, color: '#00D26A', icon: '🔫' },
  { name: 'SOLDIER', minLevel: 10, color: '#3498DB', icon: '⚔️' },
  { name: 'ENFORCER', minLevel: 20, color: '#E67E22', icon: '🛡️' },
  { name: 'LIEUTENANT', minLevel: 30, color: '#9B59B6', icon: '🎯' },
  { name: 'CAPTAIN', minLevel: 40, color: '#E94560', icon: '💀' },
  { name: 'UNDERBOSS', minLevel: 60, color: '#C8A951', icon: '👑' },
  { name: 'BOSS', minLevel: 80, color: '#FFD700', icon: '🏆' },
  { name: 'KINGPIN', minLevel: 100, color: '#E5E4E2', icon: '💎' },
] as const;

export const XP_PER_LEVEL = 500;

export const DAILY_REWARD = {
  xp: 50,
  coins: 250,
  streakBonus: {
    xp: 25,
    coins: 125,
  },
};

export const STREAK_MILESTONES: number[] = [3, 7, 14, 30, 60, 100];

export const MAX_CREW_SIZE = 10;
export const MAX_HEIST_TEAMMATES = 4;
