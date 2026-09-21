import { MATCH_MS } from './types.js';
import type { ArenaPhase, OrbKind } from './types.js';

export const ORB_BASE: Record<OrbKind, number> = {
  std: 100,
  chain: 250,
  rare: 1000,
  gold: 2500,
};

export function arenaPhase(elapsedMs: number): ArenaPhase {
  if (elapsedMs < 20_000) return 'warmup';
  if (elapsedMs < 75_000) return 'build';
  if (elapsedMs < 135_000) return 'pressure';
  return 'final';
}

export function tickInterval(elapsedMs: number): number {
  const p = arenaPhase(elapsedMs);
  if (p === 'warmup') return 170;
  if (p === 'build') return 140;
  if (p === 'pressure') return 110;
  return 85;
}

export function comboWindowMs(elapsedMs: number): number {
  const p = arenaPhase(elapsedMs);
  if (p === 'warmup') return 1800;
  if (p === 'build') return 1500;
  if (p === 'pressure') return 1300;
  return 1100;
}

export function comboMultiplier(combo: number): number {
  if (combo >= 7) return 4;
  if (combo === 6) return 3;
  if (combo === 5) return 2.5;
  if (combo === 4) return 2;
  if (combo === 3) return 1.5;
  if (combo === 2) return 1.2;
  return 1;
}

export function survivalBonus(elapsedMs: number, died: boolean): number {
  const lived = Math.min(MATCH_MS, Math.max(0, elapsedMs));
  const perSec = Math.floor(lived / 1000) * 80;
  if (died) return Math.floor(perSec * 0.35);
  const finish = lived >= MATCH_MS - 50 ? 15_000 : 0;
  return perSec + finish;
}

export function totalScore(s: {
  base: number;
  comboPts: number;
  riskPts: number;
  objective: number;
  survival: number;
}): number {
  return s.base + s.comboPts + s.riskPts + s.objective + s.survival;
}

/** Pack Score + tie-breakers into one ranking integer (higher always better). */
export function rankedInt(s: {
  score: number;
  perfect: boolean;
  objective: number;
  riskPts: number;
  maxCombo: number;
  precision: number;
  elapsedMs: number;
}): number {
  const score = Math.min(999_999, Math.max(0, Math.round(s.score)));
  const perfect = s.perfect ? 1 : 0;
  const obj = Math.min(99, Math.floor(s.objective / 1000));
  const risk = Math.min(99, Math.floor(s.riskPts / 500));
  const combo = Math.min(9, s.maxCombo);
  const prec = Math.min(9, Math.max(0, Math.round(s.precision * 9)));
  const lived = Math.min(9, Math.floor(s.elapsedMs / 20_000));
  return score * 1_000_000 + perfect * 100_000 + obj * 1_000 + risk * 10 + combo + prec + lived;
}
