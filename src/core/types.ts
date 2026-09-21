export const COLS = 20;
export const ROWS = 16;
export const MATCH_MS = 180_000;
export const START_LENGTH = 4;

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Phase = 'menu' | 'playing' | 'practice' | 'paused' | 'timeup' | 'ko';
export type ArenaPhase = 'warmup' | 'build' | 'pressure' | 'final';
export type OrbKind = 'std' | 'chain' | 'rare' | 'gold';

export interface Cell {
  x: number;
  y: number;
}

export interface Orb {
  x: number;
  y: number;
  kind: OrbKind;
}

export interface SimState {
  seed: number;
  kind: Extract<Phase, 'playing' | 'practice'>;
  phase: Phase;
  elapsedMs: number;
  tickAcc: number;
  dir: Dir;
  queued: Dir | null;
  body: Cell[];
  walls: boolean[][];
  orbs: Orb[];
  risk: { x: number; y: number; w: number; h: number; on: boolean };
  combo: number;
  comboMs: number;
  maxCombo: number;
  orbsCollected: number;
  orbsInCombo: number;
  maxOrbsInCombo: number;
  nearMisses: number;
  goldAtCombo2: boolean;
  comboDropped: boolean;
  objSafe: boolean;
  objNear: boolean;
  objGold: boolean;
  base: number;
  comboPts: number;
  riskPts: number;
  objective: number;
  survival: number;
  steps: number;
  perfectTurns: number;
  died: boolean;
  ghost: Cell[];
  ghostDir: Dir;
  ghostScore: number;
  lastPopup: string;
}

export const DIR_VEC: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
