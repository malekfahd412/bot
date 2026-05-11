"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const logger_js_1 = require("../utils/logger.js");
const approval_js_1 = require("../systems/approval.js");
const heist_js_1 = require("../systems/heist.js");
const heist_log_js_1 = require("../commands/heist-log.js");
const mission_card_js_1 = require("../canvas/mission-card.js");
exports.name = discord_js_1.Events.InteractionCreate;
async function execute(interaction, commands, config) {
    // ───────── Slash Commands ─────────
    if (interaction.isChatInputCommand()) {
        const cmd = commands.get(interaction.commandName);
        if (!cmd)
            return;
        try {
            await cmd.execute(interaction);
        }
        catch (err) {
            logger_js_1.logger.error(String(err)); // ✅ FIX 1
        }
        return;
    }
    // ───────── Modal ─────────
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('heist_modal:')) {
            try {
                await (0, heist_log_js_1.handleHeistModal)(interaction, config.reviewChannelId);
            }
            catch (err) {
                logger_js_1.logger.error(String(err)); // ✅ FIX 2
                if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ Error processing submission',
                        flags: 64,
                    }).catch(() => null);
                }
            }
        }
        return;
    }
    // ───────── Buttons ─────────
    if (!interaction.isButton())
        return;
    const [action, id] = interaction.customId.split(':');
    if (!action || !id)
        return;
    if (!interaction.inGuild())
        return;
    const isAdmin = interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.Administrator);
    if (!isAdmin) {
        await interaction.reply({
            content: '🚫 Admins only.',
            flags: 64,
        }).catch(() => null);
        return;
    }
    await interaction.deferReply();
    try {
        if (action === 'heist_approve') {
            const result = await approval_js_1.ApprovalSystem.approve(id, interaction.user.id);
            const teammates = heist_js_1.HeistSystem.getTeammates(result.submission);
            const buffer = await (0, mission_card_js_1.generateMissionCard)(result.submission.heist_name, result.submission.difficulty, `<@${result.submission.submitter_id}>`, teammates.map(t => `<@${t}>`), result.xpAwarded, result.coinsAwarded, true);
            await interaction.editReply({
                content: `✅ Approved by <@${interaction.user.id}>`,
                files: [new discord_js_1.AttachmentBuilder(buffer, { name: 'heist.png' })],
            });
        }
        if (action === 'heist_reject') {
            const submission = approval_js_1.ApprovalSystem.reject(id, interaction.user.id);
            const buffer = await (0, mission_card_js_1.generateMissionCard)(submission.heist_name, submission.difficulty, `<@${submission.submitter_id}>`, heist_js_1.HeistSystem.getTeammates(submission).map(t => `<@${t}>`), 0, 0, false);
            await interaction.editReply({
                content: `❌ Rejected`,
                files: [new discord_js_1.AttachmentBuilder(buffer, { name: 'heist.png' })],
            });
        }
        await interaction.message.edit({ components: [] }).catch(() => null);
    }
    catch (err) {
        logger_js_1.logger.error(String(err)); // ✅ FIX 3
        await interaction.editReply('❌ Something went wrong.').catch(() => null);
    }
}
//# sourceMappingURL=interaction-create.js.map