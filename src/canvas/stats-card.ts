import {
  makeCanvas, fillRoundedRect, strokeRoundedRect, drawScanlines,
  drawGlowText, drawGrid, tryLoadImage, canvasToBuffer, applyVignette
} from './renderer.js';

import { COLORS } from '../utils/constants.js';
import { getRank, formatCoins, formatNumber } from '../utils/helpers.js';
import type { Crew, Player } from '../database/schema.js';

const W = 700;

const BACKGROUND_IMAGE_PATH = 'assets/backgrounds/crew-card.png';

export async function generateCrewCard(
  crew: Crew,
  members: Player[],
  owner: Player
): Promise<Buffer> {

  const H = 180 + Math.ceil(members.length / 2) * 72 + 60;
  const { canvas, ctx } = makeCanvas(W, H);

  // =========================
  // BACKGROUND IMAGE
  // =========================
  const bg = await tryLoadImage(BACKGROUND_IMAGE_PATH);

  if (bg) {
    ctx.drawImage(bg as any, 0, 0, W, H);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0D0A00');
    bgGrad.addColorStop(1, '#0A0A14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // dark overlay for readability
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, 0, 0, W, H, 35);

  // Accent stripe
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, 0, 4, H);

  // Crew tag badge
  fillRoundedRect(ctx, 20, 20, 80, 80, 12, 'rgba(200,169,81,0.15)');
  strokeRoundedRect(ctx, 20, 20, 80, 80, 12, COLORS.gold, 2);

  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = 'center';
  ctx.fillText(`[${crew.tag}]`, 60, 67);

  // Crew name
  drawGlowText(ctx, crew.name.toUpperCase(), 118, 52, '#FFFFFF', COLORS.gold, 26, 'bold');

  ctx.font = '13px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textMuted;

  // owner display name (fixed usage)
  ctx.fillText(`OWNER: ${owner.display_name.toUpperCase()}`, 120, 74);

  if (crew.description) {
    ctx.font = '12px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(crew.description.slice(0, 60), 120, 94);
  }

  // Stats row
  const crewStats = [
    { label: 'MEMBERS', value: String(crew.member_count) },
    { label: 'HEISTS', value: String(crew.total_heists) },
    { label: 'EARNINGS', value: formatCoins(crew.total_earnings) },
  ];

  crewStats.forEach((s, i) => {
    const sx = 20 + i * 220;

    fillRoundedRect(ctx, sx, 110, 200, 50, 8, 'rgba(200,169,81,0.07)');
    strokeRoundedRect(ctx, sx, 110, 200, 50, 8, 'rgba(200,169,81,0.15)', 1);

    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'center';
    ctx.fillText(s.value, sx + 100, 135);

    ctx.font = '11px Arial';
    ctx.fillStyle = COLORS.textMuted;
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
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText('CREW MEMBERS', 24, 192);

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const col = i % 2;
    const row = Math.floor(i / 2);

    const mx = 20 + col * 340;
    const my = 200 + row * 72;
    const mw = 328;

    const rank = getRank(m.level);
    const isOwner = m.discord_id === crew.owner_id;

    fillRoundedRect(ctx, mx, my, mw, 58, 8, 'rgba(255,255,255,0.025)');
    strokeRoundedRect(
      ctx,
      mx,
      my,
      mw,
      58,
      8,
      isOwner ? 'rgba(200,169,81,0.3)' : 'rgba(200,169,81,0.08)',
      1
    );

    // Avatar ring
    const avSize = 40;

    ctx.save();
    ctx.beginPath();
    ctx.arc(mx + 28, my + 29, avSize / 2 + 1, 0, Math.PI * 2);
    ctx.fillStyle = rank.color;
    ctx.fill();
    ctx.restore();

    if (m.avatar_url) {
      const img = await tryLoadImage(m.avatar_url);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx + 28, my + 29, avSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img as any, mx + 8, my + 9, avSize, avSize);
        ctx.restore();
      }
    } else {
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'center';
      ctx.fillText(
        m.display_name.charAt(0).toUpperCase(),
        mx + 28,
        my + 34
      );
    }

    // Name (DISPLAY NAME used)
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = isOwner ? COLORS.gold : '#FFFFFF';

    ctx.fillText(
      m.display_name + (isOwner ? '  👑' : ''),
      mx + 54,
      my + 24
    );

    ctx.font = '11px Arial';
    ctx.fillStyle = rank.color;
    ctx.fillText(
      `${rank.icon} ${rank.name}  •  LVL ${m.level}`,
      mx + 54,
      my + 41
    );

    // XP
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(
      formatNumber(m.xp) + ' XP',
      mx + mw - 10,
      my + 34
    );
  }

  // Footer
  fillRoundedRect(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.06)');
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(200,169,81,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('GTA HEIST RPG  •  CREW DOSSIER', W / 2, H - 10);

  drawScanlines(ctx, W, H);
  applyVignette(ctx, W, H);

  return canvasToBuffer(canvas);
}