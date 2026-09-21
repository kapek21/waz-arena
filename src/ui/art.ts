import type { OrbKind } from '../core/types.js';

export const ASSET = {
  title: '/assets/bg_title.png',
  head: '/assets/worm_head.png',
  body: '/assets/worm_body.png',
  floor: '/assets/tile_floor.png',
  wall: '/assets/tile_wall.png',
  zone: '/assets/zone_risk.png',
  combo: '/assets/icon_combo.png',
  risk: '/assets/icon_risk.png',
  goal: '/assets/icon_goal.png',
  helper: '/assets/helper_orb.png',
} as const;

export const ORB_SRC: Record<OrbKind, string> = {
  std: '/assets/orb_std.png',
  chain: '/assets/orb_chain.png',
  rare: '/assets/orb_rare.png',
  gold: '/assets/orb_gold.png',
};

const cache = new Map<string, HTMLImageElement>();

export function img(src: string): HTMLImageElement | null {
  const hit = cache.get(src);
  if (hit) return hit.complete ? hit : null;
  const el = new Image();
  el.src = src;
  cache.set(src, el);
  return el.complete ? el : null;
}

export function preloadAssets(): void {
  Object.values(ASSET).forEach((src) => img(src));
  Object.values(ORB_SRC).forEach((src) => img(src));
}
