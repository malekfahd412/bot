import { Client, TextChannel } from "discord.js";

export async function logReset(client: Client, userId: string) {
  const channelId = process.env.RESET_LOG_CHANNEL_ID;

  if (!channelId) return;

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased()) return;

  const textChannel = channel as TextChannel;

  await textChannel.send({
    content: `🚨 **BOT RESET TRIGGERED**\n👤 By: <@${userId}>\n🕒 Time: <t:${Math.floor(Date.now() / 1000)}:F>`,
  });
}
