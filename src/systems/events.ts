import {
  Client, TextChannel, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { DIFFICULTY_CONFIG, type Difficulty } from '../utils/constants.js';
import { PlayerSystem } from './player.js';
import { CrewSystem } from './crew.js';
import { TerritoryDB } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { formatCoins, formatNumber } from '../utils/helpers.js';

/* ─────────────────────────── TYPES ─────────────────────────── */

type EventType = 'heist' | 'territory';

interface ActiveEvent {
  id: string;
  type: EventType;
  title: string;
  difficulty: Difficulty;
  xpReward: number;
  coinsReward: number;
  territory?: string;
  territoryId?: string;
  participants: Set<string>;
  messageId?: string;
  channelId: string;
  expiresAt: Date;
  status: 'open' | 'executed' | 'expired';
}

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const HEIST_NAMES = [
  'Pacific Standard Job', 'Cayo Perico Heist', 'Diamond Casino Heist',
  'The Fleeca Job', 'Prison Break', 'Series A Funding',
  'The Big Score', 'Doomsday Heist', 'Humane Labs Raid',
  'The Bogdan Problem', 'Act of Terrorism', 'The Data Breaches',
];

const DIFFICULTY_POOL: Difficulty[] = ['easy', 'easy', 'normal', 'normal', 'normal', 'hard'];

const EVENT_INTERVAL_MS = 20 * 60 * 1000;
const JOIN_WINDOW_MS = 10 * 60 * 1000;
const AUTO_EXECUTE_THRESHOLD = 6;

/* ─────────────────────────── ENGINE ─────────────────────────── */

export class EventEngine {
  private events    = new Map<string, ActiveEvent>();
  private client:    Client;
  private channelId: string;
  private intervalId?:      ReturnType<typeof setInterval>;
  private tickErrors        = 0;
  private readonly MAX_TICK_ERRORS = 5;

  constructor(client: Client, channelId: string) {
    this.client    = client;
    this.channelId = channelId;
  }

  start(): void {
    logger.info(`[EventEngine] Started (channel: ${this.channelId})`);
    // First event after 2 minutes, then every EVENT_INTERVAL_MS
    setTimeout(() => this.tick(), 2 * 60 * 1000);
    this.intervalId = setInterval(() => this.tick(), EVENT_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    logger.info('[EventEngine] Stopped.');
  }

  restart(): void {
    logger.warn('[EventEngine] Restarting after repeated errors...');
    this.stop();
    this.tickErrors = 0;
    this.events.clear();
    this.start();
  }

  private tick(): void {
    const type: EventType = Math.random() < 0.6 ? 'heist' : 'territory';
    this.spawnEvent(type).then(() => {
      this.tickErrors = 0; // reset error count on success
    }).catch(err => {
      this.tickErrors++;
      logger.error(`[EventEngine] Tick error (${this.tickErrors}/${this.MAX_TICK_ERRORS}):`, err);
      if (this.tickErrors >= this.MAX_TICK_ERRORS) {
        logger.warn('[EventEngine] Too many consecutive errors — restarting engine in 30s');
        setTimeout(() => this.restart(), 30_000);
      }
    });
  }

  async spawnEvent(type: EventType): Promise<ActiveEvent | null> {
    const channel = await this.getChannel();
    if (!channel) {
      logger.warn('Event engine: game channel not found');
      return null;
    }

    const id = uuidv4();
    const expiresAt = new Date(Date.now() + JOIN_WINDOW_MS);

    let event: ActiveEvent;
    let embed: EmbedBuilder;

    if (type === 'heist') {
      const heistName = HEIST_NAMES[Math.floor(Math.random() * HEIST_NAMES.length)];
      const difficulty = DIFFICULTY_POOL[Math.floor(Math.random() * DIFFICULTY_POOL.length)];
      const config = DIFFICULTY_CONFIG[difficulty];
      const xpReward = config.xp + Math.floor(Math.random() * 100);
      const coinsReward = config.coins + Math.floor(Math.random() * 500);

      event = {
        id, type, title: heistName, difficulty, xpReward, coinsReward,
        participants: new Set(), channelId: channel.id, expiresAt, status: 'open',
      };
      embed = this.buildHeistEmbed(event);
    } else {
      const territories = TerritoryDB.getAll();
      const territory = territories[Math.floor(Math.random() * territories.length)];

      event = {
        id, type, title: `Territory: ${territory.name}`,
        difficulty: 'normal', xpReward: 300,
        coinsReward: territory.income_per_hour * 2,
        territory: territory.name, territoryId: territory.id,
        participants: new Set(), channelId: channel.id, expiresAt, status: 'open',
      };
      embed = this.buildTerritoryEmbed(event, territory.control_crew_id);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_join:${id}`)
        .setLabel('🔫  Join')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`event_skip:${id}`)
        .setLabel('Pass')
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    event.messageId = msg.id;
    this.events.set(id, event);

    logger.game(`Event spawned: [${type}] ${event.title} (${id.slice(0, 8)})`);

    // Auto-expire after JOIN_WINDOW_MS
    setTimeout(() => this.expireEvent(id), JOIN_WINDOW_MS);

    return event;
  }

  async handleJoin(interaction: ButtonInteraction, eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'open') {
      await interaction.reply({ content: '⏰ This event has already ended.', ephemeral: true });
      return;
    }

    const userId = interaction.user.id;
    if (event.participants.has(userId)) {
      await interaction.reply({ content: '✅ You\'re already signed in for this event.', ephemeral: true });
      return;
    }

    // Ensure player exists in DB
    PlayerSystem.getOrCreate(
      userId,
      interaction.user.displayName,
      interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
    );

    event.participants.add(userId);

    await interaction.reply({
      content: `🔫 **${interaction.user.displayName}** is in. *(${event.participants.size}/${AUTO_EXECUTE_THRESHOLD} to auto-execute)*`,
    });

    if (event.participants.size >= AUTO_EXECUTE_THRESHOLD) {
      setTimeout(() => this.executeEvent(eventId), 3000);
    }
  }

  async handleSkip(interaction: ButtonInteraction): Promise<void> {
    await interaction.reply({ content: '👻 Standing down.', ephemeral: true });
  }

  private async executeEvent(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'open') return;

    event.status = 'executed';
    const participants = [...event.participants];

    if (participants.length === 0) {
      await this.expireEvent(eventId);
      return;
    }

    const rewards: string[] = [];

    for (const discordId of participants) {
      try {
        PlayerSystem.awardXP(discordId, event.xpReward);
        PlayerSystem.awardCoins(discordId, event.coinsReward);
        PlayerSystem.recordHeistResult(discordId, true, event.difficulty, event.title);

        const player = PlayerSystem.get(discordId);
        if (player?.crew_id) {
          CrewSystem.depositToBank(player.crew_id, Math.floor(event.coinsReward * 0.2));
          CrewSystem.addReputation(player.crew_id, 10);
          CrewSystem.recordHeistResult(player.crew_id, event.coinsReward);
        }

        rewards.push(`<@${discordId}>`);
      } catch (err) {
        logger.error(`Failed to reward ${discordId}:`, err);
      }
    }

    // Territory capture
    if (event.type === 'territory' && event.territoryId && participants.length > 0) {
      try {
        const topPlayer = PlayerSystem.get(participants[0]);
        if (topPlayer?.crew_id) {
          CrewSystem.captureTerritory(topPlayer.crew_id, event.territoryId);
        } else {
          TerritoryDB.setControl(event.territoryId, null);
        }
      } catch (err) {
        logger.error('Territory capture error:', err);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D26A)
      .setTitle(`✅ ${event.title} — COMPLETE`)
      .setDescription(`**${participants.length}** criminal${participants.length !== 1 ? 's' : ''} pulled off the job.`)
      .addFields(
        { name: '⚡ XP', value: `+${formatNumber(event.xpReward)} each`, inline: true },
        { name: '💰 Coins', value: `${formatCoins(event.coinsReward)} each`, inline: true },
        ...(event.type === 'territory' ? [{ name: '🏴 Territory', value: `**${event.territory}** captured`, inline: true }] : []),
        { name: '👥 Crew', value: rewards.join(' ') || 'Unknown', inline: false },
      )
      .setFooter({ text: 'GTA Heist RPG • Event Complete' })
      .setTimestamp();

    await this.updateEventMessage(event, embed);
    this.events.delete(eventId);
  }

  private async expireEvent(eventId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event || event.status !== 'open') return;

    if (event.participants.size > 0) {
      await this.executeEvent(eventId);
      return;
    }

    event.status = 'expired';

    const embed = new EmbedBuilder()
      .setColor(0x444444)
      .setTitle(`⏰ ${event.title} — EXPIRED`)
      .setDescription('Nobody showed up. The opportunity has passed.')
      .setFooter({ text: 'GTA Heist RPG • Event Expired' });

    await this.updateEventMessage(event, embed);
    this.events.delete(eventId);
  }

  private async updateEventMessage(event: ActiveEvent, embed: EmbedBuilder): Promise<void> {
    try {
      const channel = await this.getChannel();
      if (!channel || !event.messageId) return;
      const msg = await channel.messages.fetch(event.messageId);
      await msg.edit({ embeds: [embed], components: [] });
    } catch (err) {
      logger.error('Failed to update event message:', err);
    }
  }

  private buildHeistEmbed(event: ActiveEvent): EmbedBuilder {
    const diff = DIFFICULTY_CONFIG[event.difficulty];
    return new EmbedBuilder()
      .setColor(0xC8A951)
      .setTitle(`💣  HEIST AVAILABLE — ${event.title.toUpperCase()}`)
      .setDescription(
        `A new job has come in. Get your crew together.\n\n` +
        `**Difficulty:** ${diff.label}\n` +
        `**Reward:** +${formatNumber(event.xpReward)} XP  •  ${formatCoins(event.coinsReward)}\n` +
        `**Window:** 10 minutes to join`
      )
      .addFields(
        { name: '⚡ XP', value: `+${formatNumber(event.xpReward)}`, inline: true },
        { name: '💰 Coins', value: formatCoins(event.coinsReward), inline: true },
        { name: '⏳ Expires', value: `<t:${Math.floor(event.expiresAt.getTime() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Event ID: ${event.id.slice(0, 8)} • GTA Heist RPG` })
      .setTimestamp();
  }

  private buildTerritoryEmbed(event: ActiveEvent, currentOwnerId: string | null): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xE94560)
      .setTitle(`🏴  TERRITORY CONFLICT — ${(event.territory ?? '').toUpperCase()}`)
      .setDescription(
        `Control of **${event.territory}** is up for grabs.\n` +
        `Whoever fights earns passive income for their crew.\n\n` +
        `**Current control:** ${currentOwnerId ? `<crew: ${currentOwnerId.slice(0, 8)}>` : 'Unclaimed'}\n` +
        `**Window:** 10 minutes to join`
      )
      .addFields(
        { name: '⚡ XP', value: `+${formatNumber(event.xpReward)}`, inline: true },
        { name: '💰 Coins', value: formatCoins(event.coinsReward), inline: true },
        { name: '⏳ Expires', value: `<t:${Math.floor(event.expiresAt.getTime() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Event ID: ${event.id.slice(0, 8)} • GTA Heist RPG` })
      .setTimestamp();
  }

  private async getChannel(): Promise<TextChannel | null> {
    try {
      const cached = this.client.channels.cache.get(this.channelId);
      if (cached?.isTextBased()) return cached as TextChannel;
      const fetched = await this.client.channels.fetch(this.channelId);
      if (fetched?.isTextBased()) return fetched as TextChannel;
      return null;
    } catch {
      return null;
    }
  }

  getEvent(id: string): ActiveEvent | undefined {
    return this.events.get(id);
  }
}

/* ─────────────────────────── SINGLETON ─────────────────────────── */

let _engine: EventEngine | null = null;

export function initEventEngine(client: Client, channelId: string): EventEngine {
  _engine = new EventEngine(client, channelId);
  return _engine;
}

export function getEventEngine(): EventEngine | null {
  return _engine;
}
