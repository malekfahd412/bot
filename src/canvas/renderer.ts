import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { Canvas, SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { COLORS } from '../utils/constants.js';

export function makeCanvas(width: number, height: number): { canvas: Canvas; ctx: CanvasRenderingContext2D } {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, color: string
): void {
  ctx.fillStyle = color;
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
  ctx.fill();
}

export function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, color: string, lineWidth = 2
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
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
  ctx.stroke();
}

export function drawXPBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  percent: number,
  bgColor = COLORS.xpBarBg,
  fillColor = COLORS.xpBar
): void {
  const radius = height / 2;
  fillRoundedRect(ctx, x, y, width, height, radius, bgColor);
  if (percent > 0) {
    const fillWidth = Math.max(radius * 2, width * Math.min(percent, 1));
    fillRoundedRect(ctx, x, y, fillWidth, height, radius, fillColor);

    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0.0)');
    fillRoundedRect(ctx, x, y, fillWidth, height / 2, radius, 'transparent');
    ctx.fillStyle = grad;
    fillRoundedRect(ctx, x, y, fillWidth, height / 2, radius, grad as unknown as string);
  }
}

export function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

export function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color: string, glowColor: string, size: number, weight = 'bold', align: 'left' | 'center' | 'right' = 'left'
): void {
  ctx.save();
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px 'Arial'`;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 15;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawDiamondAccent(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, spacing = 30
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(200,169,81,0.06)';
  ctx.lineWidth = 0.5;
  for (let gx = x; gx < x + w; gx += spacing) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += spacing) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  ctx.restore();
}

export async function tryLoadImage(url: string) {
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

export function canvasToBuffer(canvas: Canvas): Buffer {
  return canvas.toBuffer('image/png');
}

export function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
