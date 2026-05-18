import { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { PlayerDB, CrewDB, TerritoryDB } from '../database/db.js';
import { PlayerSystem } from '../systems/player.js';
import { buildHubEmbed, buildNoCrewEmbed, buildBrowseEmbed } from '../crew-ui/embeds.js';
import { buildHubRows, buildNoCrewRows } from '../crew-ui/buttons.js';

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction;

function isButton(i: AnyInteraction): i is ButtonInteraction {
  return i.isButton();
}

async function reply(interaction: AnyInteraction, payload: any) {
  if (isButton(interaction)) {
    return interaction.update(payload);
  }
  return interaction.editReply(payload);
}

/* ─── MAIN HUB ─── */

export async function showCrewHub(interaction: AnyInteraction): Promise<void> {
  PlayerSystem.getOrCreate(
    interaction.user.id,
    interaction.user.displayName,
    interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
  );

  const player = PlayerDB.findByDiscordId(interaction.user.id)!;
  const lang = player.language ?? 'en';

  if (!player.crew_id) {
    await reply(interaction, {
      embeds: [buildNoCrewEmbed(lang)],
      components: buildNoCrewRows(lang),
    });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    PlayerDB.update(interaction.user.id, { crew_id: null as any, crew_role: 'member' });
    await reply(interaction, {
      embeds: [buildNoCrewEmbed(lang)],
      components: buildNoCrewRows(lang),
    });
    return;
  }

  const members = CrewDB.getMembers(crew.id);
  const territories = TerritoryDB.getControlledBy(crew.id);
  const isOwnerOrOfficer = player.crew_role === 'owner' || player.crew_role === 'officer';

  await reply(interaction, {
    embeds: [buildHubEmbed(crew, members, territories, lang)],
    components: buildHubRows(isOwnerOrOfficer, lang),
  });
}

/* ─── BROWSE CREWS ─── */

export async function showBrowse(interaction: ButtonInteraction): Promise<void> {
  const player = PlayerDB.findByDiscordId(interaction.user.id);
  const lang = player?.language ?? 'en';
  const crews = CrewDB.getAllCrews();
  await interaction.update({
    embeds: [buildBrowseEmbed(crews, lang)],
    components: buildNoCrewRows(lang),
  });
}
