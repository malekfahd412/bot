"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const player_js_1 = require("../systems/player.js");
const heist_js_1 = require("../systems/heist.js");
const db_js_1 = require("../database/db.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const logger_js_1 = require("../utils/logger.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin management commands')
    .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('give-xp')
    .setDescription('Award XP to a player')
    .addUserOption(o => o.setName('player').setDescription('Target player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('XP amount').setRequired(true).setMinValue(1).setMaxValue(100000))
    .addStringOption(o => o.setName('reason').setDescription('Reason (optional)').setRequired(false)))
    .addSubcommand(sub => sub.setName('give-coins')
    .setDescription('Award coins to a player')
    .addUserOption(o => o.setName('player').setDescription('Target player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Coin amount').setRequired(true).setMinValue(1).setMaxValue(10000000))
    .addStringOption(o => o.setName('reason').setDescription('Reason (optional)').setRequired(false)))
    .addSubcommand(sub => sub.setName('pending')
    .setDescription('View all pending heist submissions')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)))
    .addSubcommand(sub => sub.setName('inspect')
    .setDescription('Inspect a specific heist submission by ID')
    .addStringOption(o => o.setName('id').setDescription('Submission ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('lookup')
    .setDescription('Look up a player\'s data')
    .addUserOption(o => o.setName('player').setDescription('Target player').setRequired(true)))
    .addSubcommand(sub => sub.setName('reset-streak')
    .setDescription('Reset a player\'s streak')
    .addUserOption(o => o.setName('player').setDescription('Target player').setRequired(true)));
async function execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub = interaction.options.getSubcommand();
    const adminId = interaction.user.id;
    if (sub === 'give-xp') {
        const target = interaction.options.getUser('player', true);
        const amount = interaction.options.getInteger('amount', true);
        const reason = interaction.options.getString('reason') ?? 'Admin grant';
        const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });
        player_js_1.PlayerSystem.getOrCreate(target.id, target.display_name, avatarUrl);
        try {
            const result = player_js_1.PlayerSystem.adminGiveXP(target.id, amount);
            const player = db_js_1.PlayerDB.findByDiscordId(target.id);
            logger_js_1.logger.game(`Admin ${adminId} gave ${amount} XP to ${target.id} — Reason: ${reason}`);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xC8A951)
                .setTitle('✅ XP Awarded')
                .addFields({ name: 'Player', value: `<@${target.id}>`, inline: true }, { name: 'XP Awarded', value: `+${(0, helpers_js_1.formatNumber)(amount)} XP`, inline: true }, { name: 'New Total', value: `${(0, helpers_js_1.formatNumber)(player.xp)} XP`, inline: true }, { name: 'Level', value: `${player.level}`, inline: true }, { name: 'Leveled Up?', value: result.leveledUp ? `Yes → Level ${result.newLevel}` : 'No', inline: true }, { name: 'Rank Change?', value: result.rankChanged ? `→ ${result.newRank}` : 'No', inline: true }, { name: 'Reason', value: reason })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (err) {
            await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Failed to award XP.'}`);
        }
        return;
    }
    if (sub === 'give-coins') {
        const target = interaction.options.getUser('player', true);
        const amount = interaction.options.getInteger('amount', true);
        const reason = interaction.options.getString('reason') ?? 'Admin grant';
        const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256 });
        player_js_1.PlayerSystem.getOrCreate(target.id, target.display_name, avatarUrl);
        try {
            player_js_1.PlayerSystem.giveCoins(target.id, amount);
            const player = db_js_1.PlayerDB.findByDiscordId(target.id);
            logger_js_1.logger.game(`Admin ${adminId} gave ${amount} coins to ${target.id} — Reason: ${reason}`);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('✅ Coins Awarded')
                .addFields({ name: 'Player', value: `<@${target.id}>`, inline: true }, { name: 'Coins Awarded', value: (0, helpers_js_1.formatCoins)(amount), inline: true }, { name: 'New Balance', value: (0, helpers_js_1.formatCoins)(player.coins), inline: true }, { name: 'Reason', value: reason })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (err) {
            await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Failed to award coins.'}`);
        }
        return;
    }
    if (sub === 'pending') {
        const page = (interaction.options.getInteger('page') ?? 1) - 1;
        const pageSize = 8;
        const allPending = db_js_1.HeistDB.findPending();
        const total = allPending.length;
        if (total === 0) {
            await interaction.editReply('✅ No pending submissions. The queue is clear.');
            return;
        }
        const slice = allPending.slice(page * pageSize, (page + 1) * pageSize);
        const totalPages = Math.ceil(total / pageSize);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xFFA502)
            .setTitle(`📋 Pending Heist Submissions (${total} total)`)
            .setDescription(slice.map((s, i) => {
            const diffConfig = constants_js_1.DIFFICULTY_CONFIG[s.difficulty];
            const ago = formatTimeAgo(new Date(s.created_at));
            return [
                `**${page * pageSize + i + 1}.** \`${s.id.slice(0, 8)}\``,
                `> **${s.heist_name}** — ${diffConfig?.label ?? s.difficulty}`,
                `> By <@${s.submitter_id}> • ${ago}`,
            ].join('\n');
        }).join('\n\n'))
            .setFooter({ text: `Page ${page + 1}/${totalPages} • Use /admin inspect <id> for details` })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    if (sub === 'inspect') {
        const id = interaction.options.getString('id', true).trim();
        // Support both full ID and prefix
        const allPending = db_js_1.HeistDB.findPending();
        const submission = db_js_1.HeistDB.findById(id) ??
            allPending.find(s => s.id.startsWith(id));
        if (!submission) {
            await interaction.editReply(`❌ No submission found with ID starting with \`${id}\`.`);
            return;
        }
        const diffConfig = constants_js_1.DIFFICULTY_CONFIG[submission.difficulty];
        const teammates = heist_js_1.HeistSystem.getTeammates(submission);
        const statusEmoji = submission.status === 'approved' ? '✅' :
            submission.status === 'rejected' ? '❌' : '⏳';
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(submission.status === 'approved' ? 0x00D26A :
            submission.status === 'rejected' ? 0xFF4757 : 0xC8A951)
            .setTitle(`${statusEmoji} Submission: ${submission.heist_name}`)
            .addFields({ name: 'ID', value: `\`${submission.id}\``, inline: false }, { name: 'Status', value: submission.status.toUpperCase(), inline: true }, { name: 'Difficulty', value: diffConfig?.label ?? submission.difficulty, inline: true }, { name: 'Submitted', value: new Date(submission.created_at).toLocaleString(), inline: true }, { name: 'Submitter', value: `<@${submission.submitter_id}>`, inline: true }, { name: 'Teammates', value: teammates.length > 0 ? teammates.map(t => `<@${t}>`).join(', ') : 'Solo', inline: true }, { name: 'Proof', value: `[View Link](${submission.proof_url})`, inline: true }, ...(submission.notes ? [{ name: 'Notes', value: submission.notes, inline: false }] : []), ...(submission.reviewer_id ? [
            { name: 'Reviewed By', value: `<@${submission.reviewer_id}>`, inline: true },
            { name: 'Reviewed At', value: new Date(submission.reviewed_at).toLocaleString(), inline: true },
        ] : []), ...(submission.reviewer_note ? [{ name: 'Review Note', value: submission.reviewer_note }] : []), ...(submission.xp_awarded != null ? [
            { name: 'XP Awarded', value: `+${(0, helpers_js_1.formatNumber)(submission.xp_awarded)} XP`, inline: true },
            { name: 'Coins Awarded', value: (0, helpers_js_1.formatCoins)(submission.coins_awarded), inline: true },
        ] : []))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    if (sub === 'lookup') {
        const target = interaction.options.getUser('player', true);
        const player = db_js_1.PlayerDB.findByDiscordId(target.id);
        if (!player) {
            await interaction.editReply(`❌ **${target.display_name}** has no profile yet.`);
            return;
        }
        const rank = (0, helpers_js_1.getRank)(player.level);
        const globalRank = player_js_1.PlayerSystem.getPlayerRank(target.id);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xC8A951)
            .setTitle(`Admin Lookup: ${player.display_name}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields({ name: 'Discord ID', value: `\`${player.discord_id}\``, inline: true }, { name: 'Global Rank', value: `#${globalRank}`, inline: true }, { name: 'Level', value: String(player.level), inline: true }, { name: 'XP', value: `${(0, helpers_js_1.formatNumber)(player.xp)} XP`, inline: true }, { name: 'Coins', value: (0, helpers_js_1.formatCoins)(player.coins), inline: true }, { name: 'Rank', value: `${rank.icon} ${rank.name}`, inline: true }, { name: 'Total Heists', value: String(player.total_heists), inline: true }, { name: 'Successful', value: String(player.successful_heists), inline: true }, { name: 'Streak', value: `${player.streak_current} days (best: ${player.streak_longest})`, inline: true }, { name: 'Crew', value: player.crew_id ?? 'None', inline: true }, { name: 'Joined', value: new Date(player.created_at).toLocaleDateString(), inline: true }, { name: 'Last Heist', value: player.last_heist ? new Date(player.last_heist).toLocaleDateString() : 'Never', inline: true })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }
    if (sub === 'reset-streak') {
        const target = interaction.options.getUser('player', true);
        const player = db_js_1.PlayerDB.findByDiscordId(target.id);
        if (!player) {
            await interaction.editReply(`❌ **${target.display_name}** has no profile.`);
            return;
        }
        db_js_1.PlayerDB.update(target.id, { streak_current: 0 });
        logger_js_1.logger.game(`Admin ${adminId} reset streak for ${target.id}`);
        await interaction.editReply(`✅ Streak reset for **${target.display_name}** (was **${player.streak_current} days**).`);
        return;
    }
}
function formatTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
//# sourceMappingURL=admin.js.map