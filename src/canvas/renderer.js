"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeCanvas = makeCanvas;
exports.fillRoundedRect = fillRoundedRect;
exports.strokeRoundedRect = strokeRoundedRect;
exports.drawXPBar = drawXPBar;
exports.drawScanlines = drawScanlines;
exports.drawGlowText = drawGlowText;
exports.drawDiamondAccent = drawDiamondAccent;
exports.drawGrid = drawGrid;
exports.tryLoadImage = tryLoadImage;
exports.canvasToBuffer = canvasToBuffer;
exports.applyVignette = applyVignette;
const canvas_1 = require("@napi-rs/canvas");
const constants_js_1 = require("../utils/constants.js");
function makeCanvas(width, height) {
    const canvas = (0, canvas_1.createCanvas)(width, height);
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}
function fillRoundedRect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    roundedPath(ctx, x, y, w, h, r);
    ctx.fill();
}
function strokeRoundedRect(ctx, x, y, w, h, r, color, lineWidth = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    roundedPath(ctx, x, y, w, h, r);
    ctx.stroke();
}
function roundedPath(ctx, x, y, w, h, r) {
    const safeR = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeR, y);
    ctx.lineTo(x + w - safeR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
    ctx.lineTo(x + w, y + h - safeR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
    ctx.lineTo(x + safeR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
    ctx.lineTo(x, y + safeR);
    ctx.quadraticCurveTo(x, y, x + safeR, y);
    ctx.closePath();
}
function drawXPBar(ctx, x, y, width, height, percent, bgColor = constants_js_1.COLORS.xpBarBg, fillColor = constants_js_1.COLORS.xpBar) {
    const radius = height / 2;
    // Background track
    fillRoundedRect(ctx, x, y, width, height, radius, bgColor);
    if (percent > 0) {
        const fillWidth = Math.max(radius * 2, width * Math.min(percent, 1));
        // Filled bar
        fillRoundedRect(ctx, x, y, fillWidth, height, radius, fillColor);
        // Sheen overlay — applied directly (no string cast hack)
        ctx.save();
        const sheen = ctx.createLinearGradient(x, y, x, y + height);
        sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
        sheen.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        sheen.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = sheen;
        roundedPath(ctx, x, y, fillWidth, height, radius);
        ctx.fill();
        ctx.restore();
    }
}
function drawScanlines(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
}
function drawGlowText(ctx, text, x, y, color, glowColor, size, weight = 'bold', align = 'left') {
    ctx.save();
    ctx.textAlign = align;
    ctx.font = `${weight} ${size}px Arial`;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.restore();
}
function drawDiamondAccent(ctx, cx, cy, size, color) {
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
function drawGrid(ctx, x, y, w, h, spacing = 30) {
    ctx.save();
    ctx.strokeStyle = 'rgba(200,169,81,0.06)';
    ctx.lineWidth = 0.5;
    for (let gx = x; gx <= x + w; gx += spacing) {
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx, y + h);
        ctx.stroke();
    }
    for (let gy = y; gy <= y + h; gy += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + w, gy);
        ctx.stroke();
    }
    ctx.restore();
}
async function tryLoadImage(url) {
    try {
        return await (0, canvas_1.loadImage)(url);
    }
    catch {
        return null;
    }
}
function canvasToBuffer(canvas) {
    return canvas.toBuffer('image/png');
}
function applyVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}
//# sourceMappingURL=renderer.js.map