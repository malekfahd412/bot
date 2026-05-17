import {
  makeCanvas,
  fillRoundedRect,
  strokeRoundedRect,
  drawScanlines,
  drawGlowText,
  drawGrid,
  tryLoadImage,
  canvasToBuffer,
  applyVignette
} from './renderer.js';

import { COLORS } from '../utils/constants.js';
import { getRank, formatNumber, formatCoins } from '../utils/helpers.js';
import type { Player } from '../database/schema.js';

const W = 700;
const ROW_H = 64;
const HEADER_H = 90;
const FOOTER_H = 36;

import path from 'path';

const BACKGROUND_IMAGE = path.join(
  process.cwd(),
  'assets',
  'backgrounds',
  'leaderboard-card-v2.png'
);

export async function generateLeaderboardCard(
  players: Player[],
  type: 'xp' | 'coins' = 'xp'
): Promise<Buffer> {

  const H = HEADER_H + players.length * ROW_H + FOOTER_H + 20;
  const { canvas, ctx } = makeCanvas(W, H);

  // =========================
  // BACKGROUND IMAGE
  // =========================

  const bg = await tryLoadImage(BACKGROUND_IMAGE);

  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    // fallback background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0A0A14');
    bgGrad.addColorStop(1, '#0D0D1A');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // Dark overlay for readability
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, 0, 0, W, H, 35);

  // Left accent stripe
  const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);

  stripeGrad.addColorStop(0, COLORS.gold);
  stripeGrad.addColorStop(1, COLORS.accent);

  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, 4, H);

  // =========================
  // HEADER
  // =========================

  drawGlowText(
    ctx,
    type === 'xp'
      ? '⚔ XP LEADERBOARD'
      : '💰 WEALTH LEADERBOARD',
    W / 2,
    52,
    COLORS.primary,
    COLORS.primary,
    26,
    'bold',
    'center'
  );

  ctx.font = '13px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'center';

  ctx.fillText(
    'TOP CRIMINALS OF THE UNDERWORLD',
    W / 2,
    76
  );

  // Separator
  ctx.strokeStyle = 'rgba(200,169,81,0.2)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(20, HEADER_H);
  ctx.lineTo(W - 20, HEADER_H);
  ctx.stroke();

  // =========================
  // MEDALS
  // =========================

  const medals = [
    { text: '01', color: '#FFD700' },
    { text: '02', color: '#C0C0C0' },
    { text: '03', color: '#CD7F32' }
  ];

  // =========================
  // PLAYER ROWS
  // =========================

  for (let i = 0; i < players.length; i++) {

    const p = players[i];

    const ry = HEADER_H + 10 + i * ROW_H;

    const isTop3 = i < 3;

    // Row background
    const rowBg =
      i === 0
        ? 'rgba(200,169,81,0.10)'
        : i === 1
        ? 'rgba(180,180,180,0.07)'
        : i === 2
        ? 'rgba(180,100,50,0.07)'
        : 'rgba(255,255,255,0.02)';

    fillRoundedRect(
      ctx,
      16,
      ry,
      W - 32,
      ROW_H - 8,
      8,
      rowBg
    );

    if (isTop3) {

      strokeRoundedRect(
        ctx,
        16,
        ry,
        W - 32,
        ROW_H - 8,
        8,
        i === 0
          ? 'rgba(200,169,81,0.3)'
          : i === 1
          ? 'rgba(180,180,180,0.2)'
          : 'rgba(180,100,50,0.2)',
        1
      );
    }

    // =========================
    // RANK
    // =========================

    ctx.textAlign = 'center';

    if (isTop3) {

      ctx.font = 'bold 22px Arial';
      ctx.fillStyle = medals[i].color;

      ctx.shadowColor = medals[i].color;
      ctx.shadowBlur = 14;

      ctx.fillText(
        medals[i].text,
        46,
        ry + 38
      );

      ctx.shadowBlur = 0;

    } else {

      ctx.fillStyle = COLORS.textMuted;
      ctx.font = 'bold 16px Arial';

      ctx.fillText(
        `#${i + 1}`,
        46,
        ry + 36
      );
    }

    // =========================
    // AVATAR
    // =========================

    const rank = getRank(p.level);

    const avX = 70;
    const avY = ry + 6;
    const avSize = 44;

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      avX + avSize / 2,
      avY + avSize / 2,
      avSize / 2 + 2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = rank.color;
    ctx.fill();

    ctx.restore();

    if (p.avatar_url) {

      const avatar = await tryLoadImage(p.avatar_url);

      if (avatar) {

        ctx.save();

        ctx.beginPath();

        ctx.arc(
          avX + avSize / 2,
          avY + avSize / 2,
          avSize / 2,
          0,
          Math.PI * 2
        );

        ctx.clip();

        ctx.drawImage(
          avatar,
          avX,
          avY,
          avSize,
          avSize
        );

        ctx.restore();
      }

    } else {

      fillRoundedRect(
        ctx,
        avX,
        avY,
        avSize,
        avSize,
        avSize / 2,
        COLORS.surface
      );

      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'center';

      ctx.fillText(
        p.displayName.charAt(0).toUpperCase(),
        avX + avSize / 2,
        avY + avSize / 2 + 7
      );
    }

    // =========================
    // USERNAME
    // =========================

    ctx.textAlign = 'left';

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FFFFFF';

    ctx.fillText(
      p.displayName,
      126,
      ry + 28
    );

    ctx.font = '12px Arial';

    ctx.fillStyle = rank.color;

    ctx.fillText(
      `${rank.icon} ${rank.name}  •  LVL ${p.level}`,
      126,
      ry + 48
    );

    // =========================
    // VALUE
    // =========================

    ctx.textAlign = 'right';

    ctx.font = 'bold 18px Arial';

    ctx.fillStyle =
      type === 'xp'
        ? COLORS.primary
        : COLORS.gold;

    const displayValue =
      type === 'xp'
        ? `${formatNumber(p.xp)} XP`
        : formatCoins(p.coins);

    ctx.fillText(
      displayValue,
      W - 28,
      ry + 36
    );
  }

  // =========================
  // FOOTER
  // =========================

  const fy =
    HEADER_H +
    players.length * ROW_H +
    18;

  fillRoundedRect(
    ctx,
    0,
    fy,
    W,
    FOOTER_H,
    0,
    'rgba(200,169,81,0.06)'
  );

  ctx.font = '11px Arial';

  ctx.fillStyle = 'rgba(200,169,81,0.4)';

  ctx.textAlign = 'center';

  ctx.fillText(
    'GTA HEIST RPG  •  MOST WANTED LIST',
    W / 2,
    fy + 22
  );

  drawScanlines(ctx, W, H);

  applyVignette(ctx, W, H);

  return canvasToBuffer(canvas);
}