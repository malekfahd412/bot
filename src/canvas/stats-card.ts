import {
  makeCanvas, fillRoundedRect, strokeRoundedRect, drawScanlines,
  drawGlowText, drawGrid, tryLoadImage, canvasToBuffer, applyVignette
} from './renderer.js';
import { COLORS } from '../utils/constants.js';
import { getRank, formatCoins, formatNumber, getSuccessRate } from '../utils/helpers.js';
import type { Player, HeistSubmission, Crew } from '../database/schema.js';

const W = 700;
const CREW_BG = 'assets/backgrounds/crew-card.png';
const STATS_BG = 'assets/backgrounds/profile-card.png';

/* ─────────────────────────── CREW CARD ─────────────────────────── */

export async function generateCrewCard(crew: Crew, members: Player[], owner: Player): Promise<Buffer> {
  const H = 180 + Math.ceil(members.length / 2) * 72 + 60;
  const { canvas, ctx } = makeCanvas(W, H);

  const bg = await tryLoadImage(CREW_BG);
  if (bg) {
    ctx.drawImage(bg as any, 0, 0, W, H);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0D0A00');
    bgGrad.addColorStop(1, '#0A0A14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, 0, 0, W, H, 35);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, 0, 4, H);

  // Tag box
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
  ctx.fillText(`OWNER: ${owner.display_name.toUpperCase()}`, 120, 74);

  if (crew.description) {
    ctx.font = '12px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(crew.description.slice(0, 60), 120, 94);
  }

  // Stats
  const crewStats = [
    { label: 'MEMBERS', value: String(crew.member_count) },
    { label: 'EARNINGS', value: formatCoins(crew.total_earnings) },
  ];

  crewStats.forEach((s, i) => {
    const sx = 20 + i * 330;
    fillRoundedRect(ctx, sx, 110, 310, 50, 8, 'rgba(200,169,81,0.07)');
    strokeRoundedRect(ctx, sx, 110, 310, 50, 8, 'rgba(200,169,81,0.15)', 1);
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'center';
    ctx.fillText(s.value, sx + 155, 135);
    ctx.font = '11px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(s.label, sx + 155, 150);
  });

  // Divider
  ctx.strokeStyle = 'rgba(200,169,81,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 174); ctx.lineTo(W - 20, 174); ctx.stroke();

  // Members header
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
    strokeRoundedRect(ctx, mx, my, mw, 58, 8, isOwner ? 'rgba(200,169,81,0.3)' : 'rgba(200,169,81,0.08)', 1);

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
      ctx.fillText(m.display_name.charAt(0).toUpperCase(), mx + 28, my + 34);
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = isOwner ? COLORS.gold : '#FFFFFF';
    ctx.fillText(m.display_name + (isOwner ? '  👑' : ''), mx + 54, my + 24);
    ctx.font = '11px Arial';
    ctx.fillStyle = rank.color;
    ctx.fillText(`${rank.icon} ${rank.name}  •  LVL ${m.level}`, mx + 54, my + 41);
    ctx.textAlign = 'right';
    ctx.font = '12px Arial';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(formatNumber(m.xp) + ' XP', mx + mw - 10, my + 34);
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

/* ─────────────────────────── STATS CARD ─────────────────────────── */

export async function generateStatsCard(player: Player, recentHeists: HeistSubmission[]): Promise<Buffer> {
  const H = 520;
  const { canvas, ctx } = makeCanvas(W, H);

  const bg = await tryLoadImage(STATS_BG);
  if (bg) {
    ctx.drawImage(bg as any, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0A0A14');
    grad.addColorStop(1, '#0D0A00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, 0, 0, W, H, 35);
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, 4, H);

  // Title
  drawGlowText(ctx, 'CRIMINAL STATISTICS', 20, 46, '#FFFFFF', COLORS.primary, 22, 'bold');
  ctx.font = '13px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(player.display_name.toUpperCase(), 20, 68);

  const rank = getRank(player.level);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = rank.color;
  ctx.textAlign = 'right';
  ctx.fillText(`${rank.icon} ${rank.name}  •  LVL ${player.level}`, W - 20, 46);

  // Stat boxes
  const stats = [
    { label: 'TOTAL XP', value: formatNumber(player.xp), color: COLORS.primary },
    { label: 'COINS', value: formatCoins(player.coins), color: COLORS.gold },
    { label: 'TOTAL HEISTS', value: String(player.total_heists), color: '#FFFFFF' },
    { label: 'SUCCESSFUL', value: String(player.successful_heists), color: COLORS.success },
    { label: 'FAILED', value: String(player.failed_heists), color: COLORS.danger },
    { label: 'SUCCESS RATE', value: getSuccessRate(player.total_heists, player.successful_heists), color: COLORS.success },
    { label: 'TOTAL EARNED', value: formatCoins(player.total_earnings), color: COLORS.gold },
    { label: 'BEST STREAK', value: `${player.streak_longest} 🔥`, color: COLORS.warning },
    { label: 'HARDEST JOB', value: (player.hardest_heist ?? 'NONE').toUpperCase(), color: COLORS.accent },
  ];

  const cols = 3;
  const boxW = (W - 40) / cols;
  const boxH = 70;
  const startY = 90;

  stats.forEach((stat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = 20 + col * boxW;
    const sy = startY + row * (boxH + 8);

    fillRoundedRect(ctx, sx + 4, sy, boxW - 8, boxH, 8, 'rgba(255,255,255,0.03)');
    strokeRoundedRect(ctx, sx + 4, sy, boxW - 8, boxH, 8, 'rgba(200,169,81,0.12)', 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, sx + boxW / 2, sy + 32);
    ctx.font = '11px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(stat.label, sx + boxW / 2, sy + 52);
  });

  // Recent operations
  const sectionY = startY + 3 * (boxH + 8) + 12;
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText('RECENT OPERATIONS', 24, sectionY + 14);
  ctx.strokeStyle = 'rgba(200,169,81,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, sectionY + 20); ctx.lineTo(W - 20, sectionY + 20); ctx.stroke();

  if (recentHeists.length === 0) {
    ctx.font = '13px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('No operations on record.', W / 2, sectionY + 50);
  } else {
    recentHeists.slice(0, 4).forEach((h, i) => {
      const hy = sectionY + 28 + i * 36;
      const statusColor = h.status === 'approved' ? COLORS.success
        : h.status === 'rejected' ? COLORS.danger : COLORS.warning;

      fillRoundedRect(ctx, 20, hy, W - 40, 30, 6, 'rgba(255,255,255,0.025)');
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(h.heist_name.toUpperCase(), 32, hy + 20);
      ctx.font = '11px Arial';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText(h.difficulty.toUpperCase(), W / 2, hy + 20);
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = statusColor;
      ctx.textAlign = 'right';
      ctx.fillText(h.status.toUpperCase(), W - 32, hy + 20);
    });
  }

  // Footer
  fillRoundedRect(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.06)');
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(200,169,81,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('GTA HEIST RPG  •  STATS DOSSIER', W / 2, H - 10);
  drawScanlines(ctx, W, H);
  applyVignette(ctx, W, H);
  return canvasToBuffer(canvas);
}
