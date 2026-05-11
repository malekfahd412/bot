import type { Canvas, SKRSContext2D as Ctx } from '@napi-rs/canvas';
export { type Ctx };
export declare function makeCanvas(width: number, height: number): {
    canvas: Canvas;
    ctx: Ctx;
};
export declare function fillRoundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string): void;
export declare function strokeRoundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth?: number): void;
export declare function drawXPBar(ctx: Ctx, x: number, y: number, width: number, height: number, percent: number, bgColor?: "#2A2A3E", fillColor?: "#C8A951"): void;
export declare function drawScanlines(ctx: Ctx, w: number, h: number): void;
export declare function drawGlowText(ctx: Ctx, text: string, x: number, y: number, color: string, glowColor: string, size: number, weight?: string, align?: 'left' | 'center' | 'right'): void;
export declare function drawDiamondAccent(ctx: Ctx, cx: number, cy: number, size: number, color: string): void;
export declare function drawGrid(ctx: Ctx, x: number, y: number, w: number, h: number, spacing?: number): void;
export declare function tryLoadImage(url: string): Promise<import("@napi-rs/canvas").Image | null>;
export declare function canvasToBuffer(canvas: Canvas): Buffer;
export declare function applyVignette(ctx: Ctx, w: number, h: number): void;
//# sourceMappingURL=renderer.d.ts.map