import {
  makeCanvas, fillRoundedRect, strokeRoundedRect, drawXPBar,
  drawScanlines, drawGlowText, drawGrid, tryLoadImage, canvasToBuffer, applyVignette
} from './renderer.js';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { COLORS } from '../utils/constants.js';
import { getRank, getLevelFromXP, getXPProgress, formatNumber, formatCoins, getSuccessRate } from '../utils/helpers.js';
import type { Player } from '../database/schema.js';

const W = 800;
const H = 400;

export async function generateProfileCard(player: Player, globalRank: number): Promise<Buffer> {
  const { canvas, ctx } = makeCanvas(W, H);

  // --- Background ---
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0A0A14');
  bgGrad.addColorStop(0.5, '#12121E');
  bgGrad.addColorStop(1, '#0A0A14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, 0, 0, W, H, 35);

  // Accent stripe left
  const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);
  stripeGrad.addColorStop(0, COLORS.primary);
  stripeGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, 4, H);

  // --- Rank/level badge top right ---
  const rank = getRank(player.level);
  fillRoundedRect(ctx, W - 180, 18, 162, 36, 8, 'rgba(200,169,81,0.12)');
  strokeRoundedRect(ctx, W - 180, 18, 162, 36, 8, COLORS.primary, 1);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = COLORS.primary;
  ctx.textAlign = 'center';
  ctx.fillText(`${rank.icon}  ${rank.name}`, W - 99, 42);

  // --- Avatar ---
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
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
  } else {
    // Placeholder
    fillRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, avatarSize / 2, COLORS.surface);
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText(player.username.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 15);
  }

  // --- Username & Global Rank ---
  ctx.textAlign = 'left';
  drawGlowText(ctx, player.username, 158, 72, '#FFFFFF', COLORS.primary, 28, 'bold');

  ctx.font = '14px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`#${globalRank} GLOBAL  •  LVL ${player.level}`, 160, 100);

  // --- XP Bar ---
  const xpProgress = getXPProgress(player.xp);
  const barX = 158;
  const barY = 112;
  const barW = W - barX - 28;
  const barH = 14;

  drawXPBar(ctx, barX, barY, barW, barH, xpProgress.percent);

  ctx.font = '11px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(`XP ${formatNumber(xpProgress.current)} / ${formatNumber(xpProgress.needed)}`, barX, barY + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.primary;
  ctx.fillText(`${Math.round(xpProgress.percent * 100)}%`, barX + barW, barY + 28);

  // --- Divider ---
  ctx.strokeStyle = 'rgba(200,169,81,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 160);
  ctx.lineTo(W - 20, 160);
  ctx.stroke();

  // --- Stats Grid ---
  const stats = [
    { label: 'COINS', value: formatCoins(player.coins), color: COLORS.gold },
    { label: 'TOTAL HEISTS', value: String(player.total_heists), color: '#FFFFFF' },
    { label: 'SUCCESS RATE', value: getSuccessRate(player.total_heists, player.successful_heists), color: COLORS.success },
    { label: 'STREAK', value: `${player.streak_current}🔥`, color: COLORS.warning },
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

  // --- Footer bar ---
  fillRoundedRect(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.07)');
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(200,169,81,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('GTA HEIST RPG  •  CRIMINAL RECORD', W / 2, H - 10);

  drawScanlines(ctx, W, H);
  applyVignette(ctx, W, H);

  return canvasToBuffer(canvas);
}
