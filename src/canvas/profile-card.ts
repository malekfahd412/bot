import {
  makeCanvas, fillRoundedRect, strokeRoundedRect, drawXPBar,
  drawScanlines, drawGlowText, drawGrid, tryLoadImage, canvasToBuffer, applyVignette
} from './renderer.js';
import { COLORS } from '../utils/constants.js';
import { getRank, getXPProgress, formatNumber, formatCoins, getSuccessRate } from '../utils/helpers.js';
import type { Player } from '../database/schema.js';

const W = 800;
const H = 400;

export async function generateProfileCard(player: Player, globalRank: number): Promise<Buffer> {
  const { canvas, ctx } = makeCanvas(W, H);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0A0A14');
  bgGrad.addColorStop(0.5, '#12121E');
  bgGrad.addColorStop(1, '#0A0A14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, 0, 0, W, H, 35);

  // Left accent stripe (gradient)
  const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);
  stripeGrad.addColorStop(0, COLORS.primary);
  stripeGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, 4, H);

  // Rank/level badge — top right
  const rank = getRank(player.level);
  fillRoundedRect(ctx, W - 182, 18, 164, 36, 8, 'rgba(200,169,81,0.12)');
  strokeRoundedRect(ctx, W - 182, 18, 164, 36, 8, COLORS.primary, 1);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = COLORS.primary;
  ctx.textAlign = 'center';
  ctx.fillText(`${rank.icon}  ${rank.name}`, W - 100, 42);

  // Avatar ring
  const avatarSize = 110;
  const avatarX = 30;
  const avatarY = 30;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.primary;
  ctx.fill();
  ctx.restore();

  if (player.avatar_url) {
    const avatar = await tryLoadImage(player.avatar_url);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar as import('@napi-rs/canvas').Image, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } else {
      drawAvatarPlaceholder(ctx, player.username, avatarX, avatarY, avatarSize);
    }
  } else {
    drawAvatarPlaceholder(ctx, player.username, avatarX, avatarY, avatarSize);
  }

  // Username
  ctx.textAlign = 'left';
  drawGlowText(ctx, player.username, 158, 72, '#FFFFFF', COLORS.primary, 28, 'bold');

  ctx.font = '14px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`#${globalRank} GLOBAL  •  LVL ${player.level}`, 160, 100);

  // XP bar
  const xpProgress = getXPProgress(player.xp);
  const barX = 158;
  const barY = 112;
  const barW = W - barX - 28;
  const barH = 14;

  drawXPBar(ctx, barX, barY, barW, barH, xpProgress.percent);

  ctx.font = '11px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(`XP  ${formatNumber(xpProgress.current)} / ${formatNumber(xpProgress.needed)}`, barX, barY + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.primary;
  ctx.fillText(`${Math.round(xpProgress.percent * 100)}%`, barX + barW, barY + 28);

  // Divider
  ctx.strokeStyle = 'rgba(200,169,81,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 160);
  ctx.lineTo(W - 20, 160);
  ctx.stroke();

  // Stats grid
  const stats = [
    { label: 'COINS', value: formatCoins(player.coins), color: COLORS.gold },
    { label: 'TOTAL HEISTS', value: String(player.total_heists), color: '#FFFFFF' },
    { label: 'SUCCESS RATE', value: getSuccessRate(player.total_heists, player.successful_heists), color: COLORS.success },
    { label: 'STREAK', value: `${player.streak_current} \uD83D\uDD25`, color: COLORS.warning },
    { label: 'TOTAL EARNED', value: formatCoins(player.total_earnings), color: COLORS.gold },
    { label: 'HARDEST JOB', value: (player.hardest_heist ?? 'NONE').toUpperCase(), color: COLORS.accent },
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

    fillRoundedRect(ctx, sx + 4, sy, statW - 8, rowH - 10, 8, 'rgba(255,255,255,0.03)');
    strokeRoundedRect(ctx, sx + 4, sy, statW - 8, rowH - 10, 8, 'rgba(200,169,81,0.10)', 1);

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, sx + statW / 2, sy + 38);

    ctx.font = '11px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(stat.label, sx + statW / 2, sy + 58);
  });

  // Footer
  fillRoundedRect(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.07)');
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(200,169,81,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('GTA HEIST RPG  \u2022  CRIMINAL RECORD', W / 2, H - 10);

  drawScanlines(ctx, W, H);
  applyVignette(ctx, W, H);

  return canvasToBuffer(canvas);
}

function drawAvatarPlaceholder(ctx: ReturnType<typeof makeCanvas>['ctx'], username: string, x: number, y: number, size: number): void {
  fillRoundedRect(ctx, x, y, size, size, size / 2, '#1A1A2E');
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = COLORS.primary;
  ctx.textAlign = 'center';
  ctx.fillText(username.charAt(0).toUpperCase(), x + size / 2, y + size / 2 + 14);
}
