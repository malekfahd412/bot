import { Client } from "discord.js";
import { sendLog } from "./logClient.js";
import { LogType } from "./logTypes.js";

export class LogService {
  static channelId = process.env.LOG_CHANNEL_ID!;

  static log(
    client: Client,
    type: LogType,
    userId: string,
    targetId?: string
  ) {
    switch (type) {

      case "RESET":
        return sendLog(client, this.channelId, {
          type,
          title: "🔥 FULL BOT RESET",
          description: "All commands & systems were wiped.",
          userId,
          color: 0xff0000,
        });

      case "PLAYER_RESET":
        return sendLog(client, this.channelId, {
          type,
          title: "👤 PLAYER RESET",
          description: "Player data has been reset.",
          userId,
          targetId,
          color: 0xff8800,
        });

      case "HEIST_APPROVE":
        return sendLog(client, this.channelId, {
          type,
          title: "✅ HEIST APPROVED",
          description: "A heist submission was approved.",
          userId,
          targetId,
          color: 0x00ff99,
        });

      case "HEIST_REJECT":
        return sendLog(client, this.channelId, {
          type,
          title: "❌ HEIST REJECTED",
          description: "A heist submission was rejected.",
          userId,
          targetId,
          color: 0xff3355,
        });

      case "ADMIN_ACTION":
        return sendLog(client, this.channelId, {
          type,
          title: "⚙ ADMIN ACTION",
          description: "Admin performed a system action.",
          userId,
          color: 0x3366ff,
        });
    }
  }
}
