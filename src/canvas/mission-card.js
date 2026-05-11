"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMissionCard = generateMissionCard;
const renderer_js_1 = require("./renderer.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const W = 700;
const H = 300;
async function generateMissionCard(heistName, difficulty, submitter, teammates, xpAwarded, coinsAwarded, approved) {
    const { canvas, ctx } = (0, renderer_js_1.makeCanvas)(W, H);
    const diff = constants_js_1.DIFFICULTY_CONFIG[difficulty];
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, approved ? '#0A1A0A' : '#1A0A0A');
    bgGrad.addColorStop(1, '#0A0A14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    (0, renderer_js_1.drawGrid)(ctx, 0, 0, W, H, 35);
    // Left stripe
    ctx.fillStyle = approved ? constants_js_1.COLORS.success : constants_js_1.COLORS.danger;
    ctx.fillRect(0, 0, 4, H);
    // Status banner
    const bannerColor = approved ? 'rgba(0,210,106,0.15)' : 'rgba(255,71,87,0.15)';
    (0, renderer_js_1.fillRoundedRect)(ctx, 20, 18, W - 40, 44, 10, bannerColor);
    (0, renderer_js_1.strokeRoundedRect)(ctx, 20, 18, W - 40, 44, 10, approved ? constants_js_1.COLORS.success : constants_js_1.COLORS.danger, 1.5);
    const statusIcon = approved ? '✅' : '❌';
    const statusText = approved ? 'HEIST APPROVED — PAYDAY!' : 'HEIST REJECTED';
    (0, renderer_js_1.drawGlowText)(ctx, `${statusIcon}  ${statusText}`, W / 2, 46, approved ? constants_js_1.COLORS.success : constants_js_1.COLORS.danger, approved ? constants_js_1.COLORS.success : constants_js_1.COLORS.danger, 18, 'bold', 'center');
    // Mission name
    (0, renderer_js_1.drawGlowText)(ctx, heistName.toUpperCase(), W / 2, 98, '#FFFFFF', constants_js_1.COLORS.primary, 22, 'bold', 'center');
    // Difficulty badge
    (0, renderer_js_1.fillRoundedRect)(ctx, W / 2 - 70, 108, 140, 26, 6, `${diff.color}22`);
    (0, renderer_js_1.strokeRoundedRect)(ctx, W / 2 - 70, 108, 140, 26, 6, diff.color, 1);
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = diff.color;
    ctx.textAlign = 'center';
    ctx.fillText(`◆  ${diff.label}  ◆`, W / 2, 126);
    // Divider
    ctx.strokeStyle = 'rgba(200,169,81,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 148);
    ctx.lineTo(W - 20, 148);
    ctx.stroke();
    if (approved) {
        // Rewards
        const rewardCards = [
            { label: 'XP REWARDED', value: `+${(0, helpers_js_1.formatNumber)(xpAwarded)} XP`, color: constants_js_1.COLORS.primary },
            { label: 'COINS REWARDED', value: (0, helpers_js_1.formatCoins)(coinsAwarded), color: constants_js_1.COLORS.gold },
            { label: 'TEAM SIZE', value: `${1 + teammates.length}`, color: constants_js_1.COLORS.text },
        ];
        rewardCards.forEach((r, i) => {
            const rx = 20 + i * ((W - 40) / 3);
            const rw = (W - 40) / 3 - 8;
            (0, renderer_js_1.fillRoundedRect)(ctx, rx, 158, rw, 80, 8, 'rgba(255,255,255,0.03)');
            (0, renderer_js_1.strokeRoundedRect)(ctx, rx, 158, rw, 80, 8, 'rgba(200,169,81,0.12)', 1);
            ctx.textAlign = 'center';
            ctx.font = 'bold 22px Arial';
            ctx.fillStyle = r.color;
            ctx.fillText(r.value, rx + rw / 2, 196);
            ctx.font = '11px Arial';
            ctx.fillStyle = constants_js_1.COLORS.textMuted;
            ctx.fillText(r.label, rx + rw / 2, 218);
        });
        // Participants
        const allParticipants = [submitter, ...teammates];
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;
        ctx.fillText('CREW: ' + allParticipants.join('  ·  '), W / 2, 262);
    }
    else {
        ctx.textAlign = 'center';
        ctx.font = '15px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;
        ctx.fillText('Your submission did not meet the requirements.', W / 2, 190);
        ctx.font = '13px Arial';
        ctx.fillText('Try again and make sure your proof is valid.', W / 2, 215);
        ctx.font = '12px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;
        ctx.fillText('SUBMITTED BY: ' + submitter, W / 2, 262);
    }
    // Footer
    (0, renderer_js_1.fillRoundedRect)(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.06)');
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(200,169,81,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('GTA HEIST RPG  •  MISSION REPORT', W / 2, H - 10);
    (0, renderer_js_1.drawScanlines)(ctx, W, H);
    (0, renderer_js_1.applyVignette)(ctx, W, H);
    return (0, renderer_js_1.canvasToBuffer)(canvas);
}
//# sourceMappingURL=mission-card.js.map