import { queueDir } from '../core/sim.js';
import type { Dir, SimState } from '../core/types.js';

function mapKey(code: string): Dir | null {
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD') return 'right';
  if (code === 'ArrowUp' || code === 'KeyW') return 'up';
  if (code === 'ArrowDown' || code === 'KeyS') return 'down';
  return null;
}

export function attachKeyboard(getState: () => SimState | null): () => void {
  const down = new Set<string>();
  const onDown = (e: KeyboardEvent): void => {
    const s = getState();
    if (!s) return;
    const dir = mapKey(e.code);
    if (!dir && e.code !== 'Space' && e.code !== 'KeyP') return;
    e.preventDefault();
    if (down.has(e.code)) return;
    down.add(e.code);
    if (dir) queueDir(s, dir);
  };
  const onUp = (e: KeyboardEvent): void => {
    down.delete(e.code);
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  };
}

export function attachTouch(
  el: HTMLElement,
  getState: () => SimState | null,
): () => void {
  let sx = 0;
  let sy = 0;
  const onStart = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    if (!t) return;
    sx = t.clientX;
    sy = t.clientY;
  };
  const onEnd = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    const s = getState();
    if (!t || !s) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDir(s, dx > 0 ? 'right' : 'left');
    else queueDir(s, dy > 0 ? 'down' : 'up');
  };
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchend', onEnd);
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchend', onEnd);
  };
}
