import { COLS, ROWS, type Dir } from '../core/types.js';
import type { HudSnap } from '../core/sim.js';
import { ASSET, ORB_SRC, img } from '../ui/art.js';

const ROT: Record<Dir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

function drawSprite(
  ctx: CanvasRenderingContext2D,
  src: string,
  cx: number,
  cy: number,
  size: number,
  rot = 0,
  alpha = 1,
): void {
  const pic = img(src);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  if (pic) {
    ctx.drawImage(pic, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = '#40e878';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: HudSnap,
): void {
  const cw = w / COLS;
  const ch = h / ROWS;
  ctx.clearRect(0, 0, w, h);
  const floor = img(ASSET.floor);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * cw;
      const py = y * ch;
      if (floor) ctx.drawImage(floor, px, py, cw + 1, ch + 1);
      else {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#3aa0d8' : '#2c88c4';
        ctx.fillRect(px, py, cw + 1, ch + 1);
      }
    }
  }
  if (snap.risk.on) {
    for (let y = snap.risk.y; y < snap.risk.y + snap.risk.h; y++) {
      for (let x = snap.risk.x; x < snap.risk.x + snap.risk.w; x++) {
        drawSprite(ctx, ASSET.zone, (x + 0.5) * cw, (y + 0.5) * ch, Math.max(cw, ch) * 1.15, 0, 0.85);
      }
    }
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!snap.walls[y]![x]) continue;
      drawSprite(ctx, ASSET.wall, (x + 0.5) * cw, (y + 0.5) * ch, Math.max(cw, ch) * 1.08);
    }
  }
  for (const o of snap.orbs) {
    drawSprite(ctx, ORB_SRC[o.kind], (o.x + 0.5) * cw, (o.y + 0.5) * ch, Math.max(cw, ch) * 0.95);
  }
  const gSize = Math.max(cw, ch) * 0.82;
  for (let i = snap.ghost.length - 1; i >= 0; i--) {
    const c = snap.ghost[i]!;
    const src = i === 0 ? ASSET.head : ASSET.body;
    drawSprite(ctx, src, (c.x + 0.5) * cw, (c.y + 0.5) * ch, gSize, i === 0 ? ROT[snap.ghostDir] : 0, 0.38);
  }
  const size = Math.max(cw, ch) * 1.12;
  for (let i = snap.body.length - 1; i >= 0; i--) {
    const c = snap.body[i]!;
    const src = i === 0 ? ASSET.head : ASSET.body;
    drawSprite(ctx, src, (c.x + 0.5) * cw, (c.y + 0.5) * ch, size, i === 0 ? ROT[snap.dir] : 0);
  }
}
