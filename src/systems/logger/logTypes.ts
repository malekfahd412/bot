export type LogType =
  | 'HEIST_APPROVE'
  | 'HEIST_REJECT'
  | 'PLAYER_RESET'
  | 'BOT_RESET'
  | 'DAILY_CLAIM';

export interface LogPayload {
  type: LogType;
  title: string;
  description: string;
  userId?: string;
  targetId?: string;
  color?: number;
}
