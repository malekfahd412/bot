import { createCanvas, loadImage } from 'canvas';
import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

// ───────────────────────────────
// EXPORT: data (fix deploy error)
// ───────────────────────────────
export const data = {
  name: 'heist-log',
  description: 'Generate heist result image',
};

// ───────────────────────────────
// INTERFACE
// ───────────────────────────────
export interface HeistResult {
  success: boolean;
  xp: number;
  coins: number;
  crewName: string;
  members: number;
  missionName: string;
}

// ───────────────────────────────
// MAIN GENERATOR
// ───────────────────────────────
export async function generateHeistLog(result: HeistResult) {
  const canvas = createCanvas(900, 500);
  const ctx = canvas.getContext('2d');

  const bgPath = result.success
    ? './assets/heist-success.png'
    : './assets/heist-fail.png';

  try {
    const bg = await loadImage(bgPath);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  } catch {
    ctx.fillStyle = result.success ? '#0f1f14' : '#1f0f0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // overlay
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // title
  ctx.font = 'bold 42px Arial';
  ctx.fillStyle = result.success ? '#00ff88' : '#ff3b3b';
  ctx.fillText(result.success ? 'MISSION SUCCESS' : 'MISSION FAILED', 40, 80);

  // mission
  ctx.font = '20px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Mission: ${result.missionName}`, 40, 130);

  ctx.fillStyle = '#ccc';
  ctx.fillText(`Crew: ${result.crewName}`, 40, 170);
  ctx.fillText(`Members: ${result.members}`, 40, 200);

  // rewards box
  drawBox(ctx, 40, 240, 350, 180, result.success);

  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`+${result.xp} XP`, 60, 300);

  ctx.fillStyle = '#00e5ff';
  ctx.fillText(`+$${result.coins}`, 60, 350);

  return canvas.toBuffer();
}

// ───────────────────────────────
// HELPERS
// ───────────────────────────────
function drawBox(ctx: any, x: number, y: number, w: number, h: number, success: boolean) {
  ctx.fillStyle = success ? 'rgba(0,255,100,0.08)' : 'rgba(255,0,0,0.08)';
  ctx.strokeStyle = success ? '#00ff88' : '#ff3b3b';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect?.(x, y, w, h, 12) ?? ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
}

// ───────────────────────────────
// REQUIRED EXPORTS (fix errors)
/// ───────────────────────────────
export async function handleHeistModal() {
  // placeholder (عشان الـ import ما يكسرش build)
  return;
}

export default {
  data,
  generateHeistLog,
  handleHeistModal,
};
