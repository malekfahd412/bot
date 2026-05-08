import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('heist-log')
  .setDescription('Generate heist log card');

export async function execute(interaction: any) {
  await interaction.reply({
    content: 'Generating heist log...',
    ephemeral: true,
  });
}

export async function generateHeistLog(result: HeistResult) {
  const canvas = createCanvas(900, 500);
  const ctx = canvas.getContext('2d');

  // ── Background ─────────────────────────────
  const bgPath = result.success
    ? './assets/heist-success.png'
    : './assets/heist-fail.png';

  let bg;
  try {
    bg = await loadImage(bgPath);
  } catch (e) {
    // fallback لو الصورة مش موجودة
    bg = await loadImage('./assets/default-bg.png');
  }

  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // ── Overlay ───────────────────────────────
  ctx.fillStyle = result.success
    ? 'rgba(0, 0, 0, 0.55)'
    : 'rgba(0, 0, 0, 0.70)';

  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Title ──────────────────────────────────
  ctx.font = 'bold 42px Arial';
  const color = result.success ? '#00ff88' : '#ff3b3b';

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 25;

  ctx.fillText(
    result.success ? 'MISSION SUCCESS' : 'MISSION FAILED',
    40,
    80
  );

  ctx.shadowBlur = 0;

  // ── Info ───────────────────────────────────
  ctx.font = '20px Arial';
  ctx.fillStyle = '#ffffff';

  ctx.fillText(`Mission: ${result.missionName}`, 40, 120);
  ctx.fillText(`Crew: ${result.crewName}`, 40, 150);
  ctx.fillText(`Members: ${result.members}`, 40, 180);

  // ── Rewards Box ────────────────────────────
  drawBox(ctx, 40, 230, 350, 180, result.success);

  ctx.font = 'bold 28px Arial';

  ctx.fillStyle = '#ffd166';
  ctx.fillText(`+${result.xp} XP`, 60, 280);

  ctx.fillStyle = '#00e5ff';
  ctx.fillText(`+$${result.coins}`, 60, 330);

  // ── Glow ───────────────────────────────────
  drawGlow(ctx, 750, 120, color);

  return canvas.toBuffer();
}

// ── BOX ──────────────────────────────────────
function drawBox(ctx: any, x: number, y: number, w: number, h: number, success: boolean) {
  ctx.fillStyle = success
    ? 'rgba(0,255,100,0.08)'
    : 'rgba(255,0,0,0.08)';

  ctx.strokeStyle = success ? '#00ff88' : '#ff3b3b';
  ctx.lineWidth = 2;

  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

// ── GLOW ─────────────────────────────────────
function drawGlow(ctx: any, x: number, y: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 10, x, y, 80);

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, 80, 0, Math.PI * 2);
  ctx.fill();
}

// ── ROUND RECT ───────────────────────────────
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
