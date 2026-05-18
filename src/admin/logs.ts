import { AdminLogDB } from '../database/db.js';
import { logger } from '../utils/logger.js';
import type { AdminLog } from '../database/schema.js';

export type AdminActionType =
  | 'player_reset'
  | 'global_reset'
  | 'crew_reset'
  | 'season_start'
  | 'season_end'
  | 'give_xp'
  | 'give_coins'
  | 'reset_streak'
  | 'heist_approve'
  | 'heist_reject'
  | 'broadcast'
  | 'give_role'
  | 'remove_role';

export interface LogAction {
  adminId: string;
  actionType: AdminActionType;
  target?: string;
  details?: Record<string, unknown>;
  beforeSnapshot?: Record<string, unknown>;
}

export const AdminLogSystem = {
  log(action: LogAction): void {
    try {
      AdminLogDB.insert({
        admin_id: action.adminId,
        action_type: action.actionType,
        target: action.target ?? null,
        details: action.details ? JSON.stringify(action.details) : null,
        before_snapshot: action.beforeSnapshot ? JSON.stringify(action.beforeSnapshot) : null,
      });
      logger.game(`[ADMIN] ${action.adminId} → ${action.actionType}${action.target ? ` on ${action.target}` : ''}`);
    } catch (err) {
      logger.error('Failed to write admin log:', err);
    }
  },

  getRecent(limit = 20): AdminLog[] {
    return AdminLogDB.getRecent(limit);
  },

  formatForEmbed(logs: AdminLog[]): string {
    if (!logs.length) return '*No admin actions recorded yet.*';

    return logs.map(l => {
      const ts = `<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>`;
      const target = l.target ? ` → \`${l.target.slice(0, 12)}\`` : '';
      return `\`${l.action_type}\`${target} by <@${l.admin_id}> ${ts}`;
    }).join('\n');
  },
};
