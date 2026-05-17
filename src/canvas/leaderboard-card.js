"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLeaderboardCard = generateLeaderboardCard;
const renderer_js_1 = require("./renderer.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const W = 700;
const ROW_H = 64;
const HEADER_H = 90;
const FOOTER_H = 36;
async function generateLeaderboardCard(players, type = 'xp') {
    const H = HEADER_H + players.length * ROW_H + FOOTER_H + 20;
    const { canvas, ctx } = (0, renderer_js_1.makeCanvas)(W, H);
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0A0A14');
    bgGrad.addColorStop(1, '#0D0D1A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    (0, renderer_js_1.drawGrid)(ctx, 0, 0, W, H, 35);
    // Left accent stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);
    stripeGrad.addColorStop(0, constants_js_1.COLORS.gold);
    stripeGrad.addColorStop(1, constants_js_1.COLORS.accent);
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, 4, H);
    // Header
    (0, renderer_js_1.drawGlowText)(ctx, type === 'xp' ? '⚔ XP LEADERBOARD' : '💰 WEALTH LEADERBOARD', W / 2, 52, constants_js_1.COLORS.primary, constants_js_1.COLORS.primary, 26, 'bold', 'center');
    ctx.font = '13px Arial';
    ctx.fillStyle = constants_js_1.COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('TOP CRIMINALS OF THE UNDERWORLD', W / 2, 76);
    // Separator
    ctx.strokeStyle = 'rgba(200,169,81,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, HEADER_H);
    ctx.lineTo(W - 20, HEADER_H);
    ctx.stroke();
    // Rows
    const medals = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const ry = HEADER_H + 10 + i * ROW_H;
        const isTop3 = i < 3;
        // Row background
        const rowBg = i === 0 ? 'rgba(200,169,81,0.10)' :
            i === 1 ? 'rgba(180,180,180,0.07)' :
                i === 2 ? 'rgba(180,100,50,0.07)' :
                    'rgba(255,255,255,0.02)';
        (0, renderer_js_1.fillRoundedRect)(ctx, 16, ry, W - 32, ROW_H - 8, 8, rowBg);
        if (isTop3) {
            (0, renderer_js_1.strokeRoundedRect)(ctx, 16, ry, W - 32, ROW_H - 8, 8, i === 0 ? 'rgba(200,169,81,0.3)' : i === 1 ? 'rgba(180,180,180,0.2)' : 'rgba(180,100,50,0.2)', 1);
        }
        // Rank number/medal
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        if (isTop3) {
            ctx.fillText(medals[i], 46, ry + 36);
        }
        else {
            ctx.fillStyle = constants_js_1.COLORS.textMuted;
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`#${i + 1}`, 46, ry + 36);
        }
        // Avatar
        const rank = (0, helpers_js_1.getRank)(p.level);
        const avX = 70;
        const avY = ry + 6;
        const avSize = 44;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 2, 0, Math.PI * 2);
        ctx.fillStyle = rank.color;
        ctx.fill();
        ctx.restore();
        if (p.avatar_url) {
            const avatar = await (0, renderer_js_1.tryLoadImage)(p.avatar_url);
            if (avatar) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, avX, avY, avSize, avSize);
                ctx.restore();
            }
        }
        else {
            (0, renderer_js_1.fillRoundedRect)(ctx, avX, avY, avSize, avSize, avSize / 2, constants_js_1.COLORS.surface);
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = constants_js_1.COLORS.primary;
            ctx.textAlign = 'center';
            ctx.fillText(p.display_name.charAt(0).toUpperCase(), avX + avSize / 2, avY + avSize / 2 + 7);
        }
        // Username
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(p.display_name, 126, ry + 28);
        ctx.font = '12px Arial';
        ctx.fillStyle = rank.color;
        ctx.fillText(`${rank.icon} ${rank.name}  •  LVL ${p.level}`, 126, ry + 48);
        // Value
        ctx.textAlign = 'right';
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = type === 'xp' ? constants_js_1.COLORS.primary : constants_js_1.COLORS.gold;
        const displayValue = type === 'xp' ? `${(0, helpers_js_1.formatNumber)(p.xp)} XP` : (0, helpers_js_1.formatCoins)(p.coins);
        ctx.fillText(displayValue, W - 28, ry + 36);
    }
    // Footer
    const fy = HEADER_H + players.length * ROW_H + 18;
    (0, renderer_js_1.fillRoundedRect)(ctx, 0, fy, W, FOOTER_H, 0, 'rgba(200,169,81,0.06)');
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(200,169,81,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('GTA HEIST RPG  •  MOST WANTED LIST', W / 2, fy + 22);
    (0, renderer_js_1.drawScanlines)(ctx, W, H);
    (0, renderer_js_1.applyVignette)(ctx, W, H);
    return (0, renderer_js_1.canvasToBuffer)(canvas);
}
//# sourceMappingURL=leaderboard-card.js.map