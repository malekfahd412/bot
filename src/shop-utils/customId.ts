import { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

export function createCustomId(...parts: (string | number)[]): string {
  const id = parts.map(String).join(':');
  if (!id) throw new Error('createCustomId: result is empty');
  if (id.length > 100) throw new Error(`createCustomId: id too long (${id.length} chars): ${id}`);
  return id;
}

export function validateComponentRows(rows: AnyRow[], context = 'shop'): AnyRow[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of rows) {
    for (const comp of (row as any).components) {
      const id: string | undefined = comp.data?.custom_id;
      if (!id) continue;
      if (!id.trim()) {
        logger.warn(`[${context}] Empty custom_id found — skipping component`);
        continue;
      }
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }
  }

  if (duplicates.length > 0) {
    const msg = `[${context}] DUPLICATE custom_id(s) detected: ${duplicates.join(', ')}`;
    logger.warn(msg);
    throw new Error(msg);
  }

  return rows;
}
