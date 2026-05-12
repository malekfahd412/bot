import { Client, TextChannel } from 'discord.js';

let client: Client;

export function initLogger() {
  // بيتربط بالبوت بعد ما يشتغل
  console.log('Logger system initialized');
}

export function attachClient(c: Client) {
  client = c;
}

export async function sendLog(channelId: string, content: string) {
  if (!client) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) return;

  await (channel as TextChannel).send({
    content,
  });
}
