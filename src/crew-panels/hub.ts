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

  if (!player.crew_id) {
    await reply(interaction, {
      embeds: [buildNoCrewEmbed()],
      components: buildNoCrewRows(),
    });
    return;
  }

  const crew = CrewDB.findById(player.crew_id);
  if (!crew) {
    PlayerDB.update(interaction.user.id, { crew_id: null as any, crew_role: 'member' });
    await reply(interaction, {
      embeds: [buildNoCrewEmbed()],
      components: buildNoCrewRows(),
    });
    return;
  }

  const members = CrewDB.getMembers(crew.id);
  const territories = TerritoryDB.getControlledBy(crew.id);
  const isOwnerOrOfficer = player.crew_role === 'owner' || player.crew_role === 'officer';

  await reply(interaction, {
    embeds: [buildHubEmbed(crew, members, territories)],
    components: buildHubRows(isOwnerOrOfficer),
  });
}

/* ─── BROWSE CREWS ─── */

export async function showBrowse(interaction: ButtonInteraction): Promise<void> {
  const crews = CrewDB.getAllCrews();
  await interaction.update({
    embeds: [buildBrowseEmbed(crews)],
    components: buildNoCrewRows(),
  });
}
