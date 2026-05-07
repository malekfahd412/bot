import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Difficulty } from '../utils/constants.js';

export async function generateMissionCard(
  heistName: string,
  difficulty: Difficulty,
  submitter: string,
  teammates: string[],
  xp: number,
  coins: number,
  approved: boolean
): Promise<Buffer> {

  const canvas = createCanvas(1200, 700);
  const ctx = canvas.getContext('2d');

  // ── Background ─────────────────────────
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gradient overlay (GTA neon vibe)
  const gradient = ctx.createLinearGradient(0, 0, 1200, 700);
  gradient.addColorStop(0, 'rgba(255, 0, 128, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 255, 255, 0.15)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Header ─────────────────────────────
  ctx.fillStyle = approved ? '#00ff88' : '#ff3b3b';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(approved ? 'MISSION APPROVED' : 'MISSION REJECTED', 50, 80);

  // ── Heist Name ─────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(heistName.toUpperCase(), 50, 140);

  // ── Submitter ──────────────────────────
  ctx.font = '24px Arial';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText(`Submitted by: ${submitter}`, 50, 190);

  // ── Difficulty Badge ───────────────────
  const diffColor =
    difficulty === 'easy' ? '#00ff88' :
    difficulty === 'medium' ? '#ffd000' :
    difficulty === 'hard' ? '#ff7b00' :
    difficulty === 'extreme' ? '#ff3b3b' :
    '#b300ff';

  ctx.fillStyle = diffColor;
  ctx.fillRect(50, 220, 200, 50);

  ctx.fillStyle = '#000';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(difficulty.toUpperCase(), 70, 252);

  // ── Crew Section ───────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('CREW', 50, 330);

  ctx.font = '22px Arial';
  let y = 370;

  if (teammates.length === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('Solo Operation', 50, y);
  } else {
    teammates.forEach((member, i) => {
      ctx.fillStyle = '#00d9ff';
      ctx.fillText(`• ${member}`, 50, y + i * 35);
    });
  }

  // ── Rewards Section ────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('REWARDS', 600, 330);

  ctx.font = '24px Arial';
  ctx.fillStyle = '#00ff88';
  ctx.fillText(`XP: +${xp}`, 600, 380);

  ctx.fillStyle = '#ffd700';
  ctx.fillText(`COINS: $${coins.toLocaleString()}`, 600, 420);

  // ── Rank Icon (simple badge) ───────────
  ctx.fillStyle = '#ff00ff';
  ctx.beginPath();
  ctx.arc(1050, 120, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('RANK', 1015, 125);

  // ── Footer Glow ────────────────────────
  ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
  ctx.fillRect(0, 650, 1200, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial';
  ctx.fillText('GTA HEIST SYSTEM • CONFIDENTIAL', 50, 680);

  return canvas.toBuffer('image/png');
}
