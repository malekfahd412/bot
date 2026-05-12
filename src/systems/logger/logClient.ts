import { sendLog } from './logService.js';
import type { LogType } from './logTypes.js';

export class LogClient {
  static async log(
    channelId: string,
    type: LogType,
    message: string
  ) {
    const emoji =
      type === 'HEIST_APPROVE' ? '✅' :
      type === 'HEIST_REJECT' ? '❌' :
      type === 'PLAYER_RESET' ? '🧹' :
      type === 'BOT_RESET' ? '🚨' :
      '📌';

    await sendLog(channelId, `${emoji} **${type}**\n${message}`);
  }
}
