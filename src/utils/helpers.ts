import { RANK_THRESHOLDS, XP_PER_LEVEL } from './constants.js';

export function getLevelFromXP(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function getXPForNextLevel(currentXP: number): number {
  const level = getLevelFromXP(currentXP);
  return level * XP_PER_LEVEL;
}

export function getXPProgress(currentXP: number): { current: number; needed: number; percent: number } {
  const level = getLevelFromXP(currentXP);
  const levelStart = (level - 1) * XP_PER_LEVEL;
  const levelEnd = level * XP_PER_LEVEL;
  const current = currentXP - levelStart;
  const needed = levelEnd - levelStart;
  const percent = Math.min(current / needed, 1);
  return { current, needed, percent };
}

export function getRank(level: number): typeof RANK_THRESHOLDS[number] {
  let rank: typeof RANK_THRESHOLDS[number] = RANK_THRESHOLDS[0];
  for (const r of RANK_THRESHOLDS) {
    if (level >= r.minLevel) rank = r;
    else break;
  }
  return rank;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCoins(n: number): string {
  return `$${formatNumber(n)}`;
}

export function getSuccessRate(total: number, successful: number): string {
  if (total === 0) return '0%';
  return `${Math.round((successful / total) * 100)}%`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function parseUserMentions(text: string): string[] {
  const matches = text.match(/<@!?(\d+)>/g) ?? [];
  return matches.map(m => m.replace(/<@!?(\d+)>/, '$1'));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export function isYesterday(dateString: string): boolean {
  const date = new Date(dateString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}
