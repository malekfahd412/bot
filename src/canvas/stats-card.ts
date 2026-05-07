import {
  makeCanvas, fillRoundedRect, strokeRoundedRect, drawScanlines,
  drawGlowText, drawGrid, drawXPBar, tryLoadImage, canvasToBuffer, applyVignette
} from './renderer.js';
import { COLORS } from '../utils/constants.js';
import { getRank, formatCoins, formatNumber, getSuccessRate, getXPProgress } from '../utils/helpers.js';
import type { Player } from '../database/schema.js';
import type { HeistSubmission } from '../database/schema.js';

const W = 750;
const H = 460;

export async function generateStatsCard(player: Player, recentHeists: HeistSubmission[]): Promise<Buffer> {
  const { canvas, ctx } = makeCanvas(W, H);
  const rank = getRank(player.level);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#08080F');
  bgGrad.addColorStop(1, '#0D0D1A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, 0, 0, W, H, 40);

  // Accent stripe
  const stripeGrad = ctx.createLinearGradient(0, 0, 0, H);
  stripeGrad.addColorStop(0, rank.color);
  stripeGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, 4, H);

  // Header
  drawGlowText(ctx, `📊  ${player.username.toUpperCase()}  —  CRIMINAL RECORD`, W / 2, 45, '#FFFFFF', COLORS.primary, 20, 'bold', 'center');

  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = rank.color;
  ctx.textAlign = 'center';
  ctx.fillText(`${rank.icon}  ${rank.name}  •  LEVEL ${player.level}`, W / 2, 68);

  ctx.strokeStyle = 'rgba(200,169,81,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 82); ctx.lineTo(W - 20, 82); ctx.stroke();

  // XP bar
  const xpProg = getXPProgress(player.xp);
  ctx.font = '12px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText(`XP PROGRESS — ${formatNumber(xpProg.current)} / ${formatNumber(xpProg.needed)}`, 24, 100);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.primary;
  ctx.fillText(`${Math.round(xpProg.percent * 100)}% to LVL ${player.level + 1}`, W - 24, 100);
  drawXPBar(ctx, 20, 106, W - 40, 12, xpProg.percent);

  // Stats grid
  const statGroups = [
    {
      title: 'OPERATION STATS',
      items: [
        { label: 'Total Heists', value: String(player.total_heists) },
        { label: 'Successful', value: String(player.successful_heists), color: COLORS.success },
        { label: 'Failed', value: String(player.failed_heists), color: COLORS.danger },
        { label: 'Success Rate', value: getSuccessRate(player.total_heists, player.successful_heists), color: COLORS.warning },
      ],
    },
    {
      title: 'FINANCIAL RECORD',
      items: [
        { label: 'Current Balance', value: formatCoins(player.coins), color: COLORS.gold },
        { label: 'Total Earned', value: formatCoins(player.total_earnings), color: COLORS.gold },
        { label: 'Hardest Job', value: (player.hardest_heist ?? 'N/A').toUpperCase() },
        { label: 'Total XP', value: formatNumber(player.xp) + ' XP', color: COLORS.primary },
      ],
    },
    {
      title: 'STREAK & ACTIVITY',
      items: [
        { label: 'Current Streak', value: `${player.streak_current} 🔥`, color: COLORS.warning },
        { label: 'Best Streak', value: `${player.streak_longest} days` },
        { label: 'Last Heist', value: player.last_heist ? new Date(player.last_heist).toLocaleDateString() : 'Never' },
        { label: 'Member Since', value: new Date(player.created_at).toLocaleDateString() },
      ],
    },
  ];

  const colW = (W - 40) / 3;

  statGroups.forEach((group, gi) => {
    const gx = 20 + gi * colW;
    const gy = 132;

    fillRoundedRect(ctx, gx + 4, gy, colW - 8, 220, 10, 'rgba(255,255,255,0.02)');
    strokeRoundedRect(ctx, gx + 4, gy, colW - 8, 220, 10, 'rgba(200,169,81,0.10)', 1);

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText(group.title, gx + colW / 2, gy + 22);

    ctx.strokeStyle = 'rgba(200,169,81,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx + 12, gy + 30); ctx.lineTo(gx + colW - 12, gy + 30); ctx.stroke();

    group.items.forEach((item, ii) => {
      const iy = gy + 54 + ii * 42;

      ctx.textAlign = 'left';
      ctx.font = '11px Arial';
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(item.label.toUpperCase(), gx + 14, iy - 8);

      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = item.color ?? '#FFFFFF';
      ctx.fillText(item.value, gx + 14, iy + 8);
    });
  });

  // Recent heists
  const heistY = 370;
  ctx.strokeStyle = 'rgba(200,169,81,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, heistY); ctx.lineTo(W - 20, heistY); ctx.stroke();

  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText('RECENT OPERATIONS', 24, heistY + 18);

  const displayed = recentHeists.slice(0, 4);
  displayed.forEach((h, i) => {
    const hx = 24 + i * ((W - 48) / 4);
    const hw = (W - 48) / 4 - 8;
    const hy = heistY + 26;

    const statusColor = h.status === 'approved' ? COLORS.success : h.status === 'rejected' ? COLORS.danger : COLORS.warning;
    fillRoundedRect(ctx, hx, hy, hw, 44, 6, 'rgba(255,255,255,0.02)');
    strokeRoundedRect(ctx, hx, hy, hw, 44, 6, `${statusColor}33`, 1);

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    const name = h.heist_name.length > 14 ? h.heist_name.slice(0, 14) + '…' : h.heist_name;
    ctx.fillText(name, hx + 8, hy + 18);

    ctx.font = '10px Arial';
    ctx.fillStyle = statusColor;
    ctx.fillText(h.status.toUpperCase(), hx + 8, hy + 34);
  });

  if (displayed.length === 0) {
    ctx.font = '13px Arial';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('No heists on record yet. Start your criminal career!', W / 2, heistY + 48);
  }

  // Footer
  fillRoundedRect(ctx, 0, H - 28, W, 28, 0, 'rgba(200,169,81,0.06)');
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(200,169,81,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('GTA HEIST RPG  •  FULL CRIMINAL DOSSIER', W / 2, H - 10);

  drawScanlines(ctx, W, H);
  applyVignette(ctx, W, H);

  return canvasToBuffer(canvas);
}
