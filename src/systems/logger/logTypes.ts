export type LogType =
  | "RESET"
  | "PLAYER_RESET"
  | "HEIST_APPROVE"
  | "HEIST_REJECT"
  | "ADMIN_ACTION";

export interface LogPayload {
  type: LogType;
  title: string;
  description: string;
  userId?: string;
  targetId?: string;
  color?: number;
}
