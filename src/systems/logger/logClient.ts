import { EmbedBuilder, TextChannel, Client } from "discord.js";
import { LogPayload } from "./logTypes.js";

export async function sendLog(
  client: Client,
  channelId: string,
  payload: LogPayload
) {
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(payload.title)
    .setDescription(payload.description)
    .setColor(payload.color ?? 0xffcc00)
    .setTimestamp(new Date());

  if (payload.userId) {
    embed.addFields({
      name: "👮 Admin",
      value: `<@${payload.userId}>`,
      inline: true,
    });
  }

  if (payload.targetId) {
    embed.addFields({
      name: "🎯 Target",
      value: `<@${payload.targetId}>`,
      inline: true,
    });
  }

  await (channel as TextChannel).send({ embeds: [embed] });
}
