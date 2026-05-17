"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCrewCard = generateCrewCard;
const renderer_js_1 = require("./renderer.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");
const W = 700;
async function generateCrewCard(crew, members, owner) {
    const H = 180 + Math.ceil(members.length / 2) * 72 + 60;
    const { canvas, ctx } = (0, renderer_js_1.makeCanvas)(W, H);
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0D0A00');
    bgGrad.addColorStop(1, '#0A0A14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    (0, renderer_js_1.drawGrid)(ctx, 0, 0, W, H, 35);
    // Accent stripe
    ctx.fillStyle = constants_js_1.COLORS.gold;
    ctx.fillRect(0, 0, 4, H);
    // Crew tag badge
    (0, renderer_js_1.fillRoundedRect)(ctx, 20, 20, 80, 80, 12, 'rgba(200,169,81,0.15)');
    (0, renderer_js_1.strokeRoundedRect)(ctx, 20, 20, 80, 80, 12, constants_js_1.COLORS.gold, 2);
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = constants_js_1.COLORS.gold;
    ctx.textAlign = 'center';
    ctx.fillText(`[${crew.tag}]`, 60, 67);
    // Crew name
    (0, renderer_js_1.drawGlowText)(ctx, crew.name.toUpperCase(), 118, 52, '#FFFFFF', constants_js_1.COLORS.gold, 26, 'bold');
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = constants_js_1.COLORS.textMuted;
    ctx.fillText(`OWNER: ${owner.display_name.toUpperCase()}`, 120, 74);
    if (crew.description) {
        ctx.font = '12px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;
        ctx.fillText(crew.description.slice(0, 60), 120, 94);
    }
    // Stats row
    const crewStats = [
        { label: 'MEMBERS', value: String(crew.member_count) },
        { label: 'HEISTS', value: String(crew.total_heists) },
        { label: 'EARNINGS', value: (0, helpers_js_1.formatCoins)(crew.total_earnings) },
    ];
    crewStats.forEach((s, i) => {
        const sx = 20 + i * 220;
        (0, renderer_js_1.fillRoundedRect)(ctx, sx, 110, 200, 50, 8, 'rgba(200,169,81,0.07)');
        (0, renderer_js_1.strokeRoundedRect)(ctx, sx, 110, 200, 50, 8, 'rgba(200,169,81,0.15)', 1);
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = constants_js_1.COLORS.gold;
        ctx.textAlign = 'center';
        ctx.fillText(s.value, sx + 100, 135);
        ctx.font = '11px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;
        ctx.fillText(s.label, sx + 100, 150);
    });
    // Divider
    ctx.strokeStyle = 'rgba(200,169,81,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 174);
    ctx.lineTo(W - 20, 174);
    ctx.stroke();
    // Members
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = constants_js_1.COLORS.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText('CREW MEMBERS', 24, 192);
    for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const mx = 20 + col * 340;
        const my = 200 + row * 72;
        const mw = 328;
        const rank = (0, helpers_js_1.getRank)(m.level);
        const isOwner = m.discord_id === crew.owner_id;
        (0, renderer_js_1.fillRoundedRect)(ctx, mx, my, mw, 58, 8, 'rgba(255,255,255,0.025)');
        (0, renderer_js_1.strokeRoundedRect)(ctx, mx, my, mw, 58, 8, isOwner ? 'rgba(200,169,81,0.3)' : 'rgba(200,169,81,0.08)', 1);
        // Avatar
        const avSize = 40;
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx + 28, my + 29, avSize / 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = rank.color;
        ctx.fill();
        ctx.restore();
        if (m.avatar_url) {
            const img = await (0, renderer_js_1.tryLoadImage)(m.avatar_url);
            if (img) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(mx + 28, my + 29, avSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, mx + 8, my + 9, avSize, avSize);
                ctx.restore();
            }
        }
        else {
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = constants_js_1.COLORS.primary;
            ctx.textAlign = 'center';
            ctx.fillText(m.display_name.charAt(0).toUpperCase(), mx + 28, my + 34);
        }
        // Name
        ctx.textAlign = 'left';
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = isOwner ? constants_js_1.COLORS.gold : '#FFFFFF';
        ctx.fillText(m.display_name + (isOwner ? '  👑' : ''), mx + 54, my + 24);
        ctx.font = '11px Arial';
        ctx.fillStyle = rank.color;
        ctx.fillText(`${rank.icon} ${rank.name}  •  LVL ${m.level}`, mx + 54, my + 41);
        // XP
        ctx.textAlign = 'right';
        ctx.font = '12px Arial';
        ctx.fillStyle = constants_js_1.COLORS.primary;
        ctx.fillText((0, helpers_js_1.formatNumber)(m.xp) + ' XP', mx + mw - 10, my + 34);
    }
    // Footer
    (0, renderer_js_1.fillRoundedRect)(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.06)');
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(200,169,81,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('GTA HEIST RPG  •  CREW DOSSIER', W / 2, H - 10);
    (0, renderer_js_1.drawScanlines)(ctx, W, H);
    (0, renderer_js_1.applyVignette)(ctx, W, H);
    return (0, renderer_js_1.canvasToBuffer)(canvas);
}
//# sourceMappingURL=crew-card.js.map