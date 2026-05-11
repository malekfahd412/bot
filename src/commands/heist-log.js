"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
exports.handleHeistModal = handleHeistModal;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const heist_js_1 = require("../systems/heist.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const logger_js_1 = require("../utils/logger.js");
/* ───────────────────────────────────────────── */
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('heist-log')
    .setDescription('Submit a completed heist for staff review and rewards')
    .addStringOption(opt => opt.setName('difficulty')
    .setDescription('Difficulty of the heist')
    .setRequired(true)
    .addChoices({ name: '🟢 Easy', value: 'easy' }, { name: '🟡 Normal', value: 'normal' }, { name: '🔴 Hard', value: 'hard' }));
/* ───────────────────────────────────────────── */
async function execute(interaction) {
    const difficulty = interaction.options.getString('difficulty', true);
    const diffConfig = constants_js_1.DIFFICULTY_CONFIG[difficulty];
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`heist_modal:${difficulty}`)
        .setTitle(`Heist Log — ${diffConfig.label}`);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId('heist_name')
        .setLabel('Heist Name')
        .setPlaceholder('e.g. The Cayo Perico Job, Diamond Casino Heist')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId('proof_url')
        .setLabel('Proof URL')
        .setPlaceholder('https://imgur.com/... or https://streamable.com/...')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId('notes')
        .setLabel('Notes (optional)')
        .setPlaceholder('Any additional context about the heist...')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setRequired(false)));
    await interaction.showModal(modal);
}
/* ───────────────────────────────────────────── */
/* USER SELECT MENU STEP (NEW UI) */
/* ───────────────────────────────────────────── */
async function askTeammates(interaction) {
    const hostId = interaction.user.id;
    const menu = new discord_js_1.UserSelectMenuBuilder()
        .setCustomId('heist_team_select')
        .setPlaceholder('Select up to 3 teammates')
        .setMinValues(0)
        .setMaxValues(3);
    const row = new discord_js_1.ActionRowBuilder().addComponents(menu);
    await interaction.followUp({
        content: '👥 اختر أعضاء الفريق (حد أقصى 3)',
        components: [row],
        flags: 64,
    });
    return new Promise((resolve) => {
        const collector = interaction.channel?.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.UserSelect,
            time: 60000,
        });
        collector?.on('collect', async (i) => {
            if (i.customId !== 'heist_team_select')
                return;
            let users = i.values;
            // remove duplicates + host
            users = users.filter(u => u !== hostId);
            await i.update({
                content: `✅ Selected teammates: ${users.map(u => `<@${u}>`).join(', ') || 'None'}`,
                components: [],
            });
            collector.stop();
            resolve(users);
        });
        collector?.on('end', (_, reason) => {
            if (reason === 'time')
                resolve([]);
        });
    });
}
/* ───────────────────────────────────────────── */
async function handleHeistModal(interaction, reviewChannelId) {
    await interaction.deferReply({ flags: 64 });
    const [, difficulty] = interaction.customId.split(':');
    const heistName = interaction.fields.getTextInputValue('heist_name').trim();
    const proofUrl = interaction.fields.getTextInputValue('proof_url').trim();
    const notes = interaction.fields.getTextInputValue('notes') || '';
    const user = interaction.user;
    player_js_1.PlayerSystem.getOrCreate(user.id, user.username, user.displayAvatarURL({ extension: 'png', size: 256 }));
    // 👇 اختيار التيم باستخدام UI
    const teammates = await askTeammates(interaction);
    const finalTeam = [user.id, ...teammates].slice(0, 4);
    const diffConfig = constants_js_1.DIFFICULTY_CONFIG[difficulty];
    const rewards = heist_js_1.HeistSystem.calculateRewards(difficulty);
    try {
        const submission = heist_js_1.HeistSystem.submit({
            submitterId: user.id,
            heistName,
            difficulty,
            teammates: finalTeam,
            proofUrl,
            notes: notes || undefined,
            submissionChannelId: interaction.channelId ?? undefined,
        });
        if (reviewChannelId && interaction.guild) {
            const channel = await fetchTextChannel(interaction.guild, reviewChannelId);
            if (channel) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xC8A951)
                    .setTitle(`HEIST — ${heistName}`)
                    .setDescription(`**Host:** <@${user.id}>\n` +
                    `**Team:** ${finalTeam.map(u => `<@${u}>`).join(', ')}\n` +
                    `**Difficulty:** ${diffConfig.label}`)
                    .addFields({ name: 'Proof', value: `[View](${proofUrl})`, inline: true }, { name: 'XP', value: `~${(0, helpers_js_1.formatNumber)(rewards.xp)}`, inline: true }, { name: 'Coins', value: `~$${(0, helpers_js_1.formatNumber)(rewards.coins)}`, inline: true })
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: `ID: ${submission.id}` })
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`heist_approve:${submission.id}`)
                    .setLabel('APPROVE')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`heist_reject:${submission.id}`)
                    .setLabel('REJECT')
                    .setStyle(discord_js_1.ButtonStyle.Danger));
                const msg = await channel.send({ embeds: [embed], components: [row] });
                heist_js_1.HeistSystem.setReviewMessage(submission.id, msg.id);
            }
        }
        await interaction.editReply({
            content: `✅ Heist submitted successfully!\nID: \`${submission.id}\``,
        });
        logger_js_1.logger.game(`Heist submitted by ${user.username}`);
    }
    catch (err) {
        logger_js_1.logger.error(String(err));
        await interaction.editReply('❌ Failed to submit heist.');
    }
}
/* ───────────────────────────────────────────── */
async function fetchTextChannel(guild, id) {
    try {
        const cached = guild.channels.cache.get(id);
        if (cached?.isTextBased())
            return cached;
        const fetched = await guild.channels.fetch(id);
        if (fetched?.isTextBased())
            return fetched;
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=heist-log.js.map