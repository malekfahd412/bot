"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

exports.generateProfileCard = generateProfileCard;

const renderer_js_1 = require("./renderer.js");
const constants_js_1 = require("../utils/constants.js");
const helpers_js_1 = require("../utils/helpers.js");

const W = 800;
const H = 400;

async function generateProfileCard(player, globalRank) {

    const { canvas, ctx } = (0, renderer_js_1.makeCanvas)(W, H);

    // =========================
    // DISPLAY NAME FIX
    // =========================
    const displayName = player.display_name || player.display_name;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);

    bgGrad.addColorStop(0, '#0A0A14');
    bgGrad.addColorStop(0.5, '#12121E');
    bgGrad.addColorStop(1, '#0A0A14');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    (0, renderer_js_1.drawGrid)(ctx, 0, 0, W, H, 35);

    // Left accent stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);

    stripeGrad.addColorStop(0, constants_js_1.COLORS.primary);
    stripeGrad.addColorStop(1, constants_js_1.COLORS.accent);

    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, 4, H);

    // Rank badge
    const rank = (0, helpers_js_1.getRank)(player.level);

    (0, renderer_js_1.fillRoundedRect)(
        ctx,
        W - 182,
        18,
        164,
        36,
        8,
        'rgba(200,169,81,0.12)'
    );

    (0, renderer_js_1.strokeRoundedRect)(
        ctx,
        W - 182,
        18,
        164,
        36,
        8,
        constants_js_1.COLORS.primary,
        1
    );

    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = constants_js_1.COLORS.primary;
    ctx.textAlign = 'center';

    ctx.fillText(
        `${rank.icon}  ${rank.name}`,
        W - 100,
        42
    );

    // Avatar
    const avatarSize = 110;
    const avatarX = 30;
    const avatarY = 30;

    ctx.save();

    ctx.beginPath();

    ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2 + 3,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = constants_js_1.COLORS.primary;
    ctx.fill();

    ctx.restore();

    if (player.avatar_url) {

        const avatar = await (0, renderer_js_1.tryLoadImage)(player.avatar_url);

        if (avatar) {

            ctx.save();

            ctx.beginPath();

            ctx.arc(
                avatarX + avatarSize / 2,
                avatarY + avatarSize / 2,
                avatarSize / 2,
                0,
                Math.PI * 2
            );

            ctx.clip();

            ctx.drawImage(
                avatar,
                avatarX,
                avatarY,
                avatarSize,
                avatarSize
            );

            ctx.restore();

        } else {

            drawAvatarPlaceholder(
                ctx,
                displayName,
                avatarX,
                avatarY,
                avatarSize
            );
        }

    } else {

        drawAvatarPlaceholder(
            ctx,
            displayName,
            avatarX,
            avatarY,
            avatarSize
        );
    }

    // Username
    ctx.textAlign = 'left';

    (0, renderer_js_1.drawGlowText)(
        ctx,
        displayName,
        158,
        72,
        '#FFFFFF',
        constants_js_1.COLORS.primary,
        28,
        'bold'
    );

    ctx.font = '14px Arial';
    ctx.fillStyle = constants_js_1.COLORS.textMuted;

    ctx.fillText(
        `#${globalRank} GLOBAL  •  LVL ${player.level}`,
        160,
        100
    );

    // XP bar
    const xpProgress = (0, helpers_js_1.getXPProgress)(player.xp);

    const barX = 158;
    const barY = 112;
    const barW = W - barX - 28;
    const barH = 14;

    (0, renderer_js_1.drawXPBar)(
        ctx,
        barX,
        barY,
        barW,
        barH,
        xpProgress.percent
    );

    ctx.font = '11px Arial';
    ctx.fillStyle = constants_js_1.COLORS.textMuted;
    ctx.textAlign = 'left';

    ctx.fillText(
        `XP  ${(0, helpers_js_1.formatNumber)(xpProgress.current)} / ${(0, helpers_js_1.formatNumber)(xpProgress.needed)}`,
        barX,
        barY + 28
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = constants_js_1.COLORS.primary;

    ctx.fillText(
        `${Math.round(xpProgress.percent * 100)}%`,
        barX + barW,
        barY + 28
    );

    // Divider
    ctx.strokeStyle = 'rgba(200,169,81,0.15)';
    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(20, 160);
    ctx.lineTo(W - 20, 160);

    ctx.stroke();

    // Stats
    const stats = [
        {
            label: 'COINS',
            value: (0, helpers_js_1.formatCoins)(player.coins),
            color: constants_js_1.COLORS.gold
        },
        {
            label: 'TOTAL HEISTS',
            value: String(player.total_heists),
            color: '#FFFFFF'
        },
        {
            label: 'SUCCESS RATE',
            value: (0, helpers_js_1.getSuccessRate)(
                player.total_heists,
                player.successful_heists
            ),
            color: constants_js_1.COLORS.success
        },
        {
            label: 'STREAK',
            value: `${player.streak_current} 🔥`,
            color: constants_js_1.COLORS.warning
        },
        {
            label: 'TOTAL EARNED',
            value: (0, helpers_js_1.formatCoins)(player.total_earnings),
            color: constants_js_1.COLORS.gold
        },
        {
            label: 'HARDEST JOB',
            value: (player.hardest_heist ?? 'NONE').toUpperCase(),
            color: constants_js_1.COLORS.accent
        },
    ];

    const cols = 3;
    const statW = (W - 40) / cols;

    const statStartY = 175;
    const rowH = 90;

    stats.forEach((stat, i) => {

        const col = i % cols;
        const row = Math.floor(i / cols);

        const sx = 20 + col * statW;
        const sy = statStartY + row * rowH;

        (0, renderer_js_1.fillRoundedRect)(
            ctx,
            sx + 4,
            sy,
            statW - 8,
            rowH - 10,
            8,
            'rgba(255,255,255,0.03)'
        );

        (0, renderer_js_1.strokeRoundedRect)(
            ctx,
            sx + 4,
            sy,
            statW - 8,
            rowH - 10,
            8,
            'rgba(200,169,81,0.10)',
            1
        );

        ctx.textAlign = 'center';

        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = stat.color;

        ctx.fillText(
            stat.value,
            sx + statW / 2,
            sy + 38
        );

        ctx.font = '11px Arial';
        ctx.fillStyle = constants_js_1.COLORS.textMuted;

        ctx.fillText(
            stat.label,
            sx + statW / 2,
            sy + 58
        );
    });

    // Footer
    (0, renderer_js_1.fillRoundedRect)(
        ctx,
        0,
        H - 28,
        W,
        28,
        0,
        'rgba(200,169,81,0.07)'
    );

    ctx.font = '11px Arial';

    ctx.fillStyle = 'rgba(200,169,81,0.4)';
    ctx.textAlign = 'center';

    ctx.fillText(
        'GTA HEIST RPG  •  CRIMINAL RECORD',
        W / 2,
        H - 10
    );

    (0, renderer_js_1.drawScanlines)(ctx, W, H);
    (0, renderer_js_1.applyVignette)(ctx, W, H);

    return (0, renderer_js_1.canvasToBuffer)(canvas);
}

function drawAvatarPlaceholder(ctx, display_name, x, y, size) {

    (0, renderer_js_1.fillRoundedRect)(
        ctx,
        x,
        y,
        size,
        size,
        size / 2,
        '#1A1A2E'
    );

    ctx.font = 'bold 40px Arial';

    ctx.fillStyle = constants_js_1.COLORS.primary;
    ctx.textAlign = 'center';

    ctx.fillText(
        display_name.charAt(0).toUpperCase(),
        x + size / 2,
        y + size / 2 + 14
    );
}