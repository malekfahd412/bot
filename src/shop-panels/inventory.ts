import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { PlayerSystem } from '../systems/player.js';
import { InventoryDB, BoostDB } from '../database/db.js';
import { buildInventoryEmbed } from '../shop-ui/embeds.js';
import { buildInventoryRows } from '../shop-ui/buttons.js';

const PAGE_SIZE = 6;

export async function showInventory(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  page: number,
): Promise<void> {
  const user = interaction.user;
  const player = PlayerSystem.getOrCreate(
    user.id,
    user.displayName,
    user.displayAvatarURL({ extension: 'png', size: 256 }),
  );
  const lang = player.language ?? 'en';

  BoostDB.purgeExpired();

  const items = InventoryDB.getPlayer(user.id);
  const boosts = BoostDB.getActive(user.id);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const embed = buildInventoryEmbed(items, boosts, player, safePage, totalPages, lang);
  const rows = buildInventoryRows(items, safePage, totalPages, lang);

  await interaction.update({ embeds: [embed], components: rows });
}
