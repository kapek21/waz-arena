import {
  COLS,
  DIR_VEC,
  MATCH_MS,
  OPPOSITE,
  ROWS,
  START_LENGTH,
  type Cell,
  type Dir,
  type Orb,
  type OrbKind,
  type Phase,
  type SimState,
} from './types.js';
import { hashSeed, mulberry32, pickInt, roundSeed } from './rng.js';
import {
  arenaPhase,
  comboMultiplier,
  comboWindowMs,
  ORB_BASE,
  rankedInt,
  survivalBonus,
  tickInterval,
  totalScore,
} from './scoring.js';
import { buildWalls, freeCells, inBounds, key, occupiedSet } from './map.js';

function onBody(body: Cell[], x: number, y: number): boolean {
  return body.some((c) => c.x === x && c.y === y);
}

function inRisk(s: SimState, x: number, y: number): boolean {
  if (!s.risk.on) return false;
  return x >= s.risk.x && x < s.risk.x + s.risk.w && y >= s.risk.y && y < s.risk.y + s.risk.h;
}

function spawnStart(): Cell[] {
  const body: Cell[] = [];
  for (let i = START_LENGTH - 1; i >= 0; i--) {
    body.push({ x: 4 - i, y: 8 });
  }
  return body;
}

function pickRisk(seed: number, n: number): { x: number; y: number } {
  const rand = mulberry32(hashSeed(seed + n * 97));
  return { x: pickInt(rand, 3, COLS - 6), y: pickInt(rand, 3, ROWS - 6) };
}

function nextKind(elapsedMs: number, rand: () => number): OrbKind {
  const p = arenaPhase(elapsedMs);
  const r = rand();
  if (p === 'final' && r < 0.18) return 'gold';
  if (p === 'pressure' && r < 0.12) return 'rare';
  if (p === 'final' && r < 0.28) return 'rare';
  if (r < 0.22) return 'chain';
  if (p !== 'warmup' && r < 0.08) return 'rare';
  return 'std';
}

function refillOrbs(s: SimState, rand: () => number): void {
  const want = arenaPhase(s.elapsedMs) === 'warmup' ? 4 : 5;
  const blocked = occupiedSet(s.body, s.orbs);
  for (const g of s.ghost) blocked.add(key(g.x, g.y));
  const free = freeCells(s.walls, blocked);
  while (s.orbs.length < want && free.length) {
    const i = Math.floor(rand() * free.length);
    const cell = free.splice(i, 1)[0];
    if (!cell) break;
    s.orbs.push({ x: cell.x, y: cell.y, kind: nextKind(s.elapsedMs, rand) });
  }
}

function wallAdjacent(s: SimState, x: number, y: number): number {
  let n = 0;
  for (const d of Object.values(DIR_VEC)) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (!inBounds(nx, ny) || s.walls[ny]![nx] || onBody(s.body, nx, ny)) n += 1;
  }
  return n;
}

function validDirs(body: Cell[], walls: boolean[][], dir: Dir): Dir[] {
  const head = body[0];
  if (!head) return [];
  const out: Dir[] = [];
  for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
    if (d === OPPOSITE[dir]) continue;
    const n = { x: head.x + DIR_VEC[d].x, y: head.y + DIR_VEC[d].y };
    if (!inBounds(n.x, n.y) || walls[n.y]![n.x]) continue;
    if (onBody(body.slice(0, -1), n.x, n.y)) continue;
    out.push(d);
  }
  return out;
}

function nearestOrb(head: Cell, orbs: Orb[]): Orb | null {
  let best: Orb | null = null;
  let dist = Infinity;
  for (const o of orbs) {
    const d = Math.abs(o.x - head.x) + Math.abs(o.y - head.y);
    if (d < dist) {
      dist = d;
      best = o;
    }
  }
  return best;
}

function stepGhost(s: SimState): void {
  const head = s.ghost[0];
  if (!head) return;
  const target = nearestOrb(head, s.orbs);
  const options = validDirs(s.ghost, s.walls, s.ghostDir);
  if (!options.length) return;
  let chosen = options[0]!;
  if (target) {
    let best = Infinity;
    for (const d of options) {
      const nx = head.x + DIR_VEC[d].x;
      const ny = head.y + DIR_VEC[d].y;
      const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
      if (dist < best) {
        best = dist;
        chosen = d;
      }
    }
  }
  s.ghostDir = chosen;
  const next = { x: head.x + DIR_VEC[chosen].x, y: head.y + DIR_VEC[chosen].y };
  const eat = s.orbs.findIndex((o) => o.x === next.x && o.y === next.y);
  s.ghost.unshift(next);
  if (eat >= 0) {
    const orb = s.orbs.splice(eat, 1)[0]!;
    s.ghostScore += ORB_BASE[orb.kind];
  } else {
    s.ghost.pop();
  }
}

function applyObjectives(s: SimState): void {
  if (!s.objSafe && s.maxOrbsInCombo >= 40) {
    s.objSafe = true;
    s.objective += 8000;
    s.lastPopup = '+8000 cel: 40 combo';
  }
  if (!s.objNear && s.nearMisses >= 8) {
    s.objNear = true;
    s.objective += 18_000;
    s.lastPopup = '+18000 cel: near-miss';
  }
  if (!s.objGold && s.goldAtCombo2) {
    s.objGold = true;
    s.objective += 35_000;
    s.lastPopup = '+35000 cel: złoto ×2';
  }
}

function collect(s: SimState, orb: Orb): void {
  const window = comboWindowMs(s.elapsedMs);
  if (s.combo > 0 && s.comboMs > 0 && s.comboMs < window) {
    s.combo += 1;
  } else {
    if (s.combo >= 2) s.comboDropped = true;
    s.combo = 1;
    s.orbsInCombo = 0;
  }
  s.comboMs = window;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.orbsCollected += 1;
  s.orbsInCombo += 1;
  s.maxOrbsInCombo = Math.max(s.maxOrbsInCombo, s.orbsInCombo);
  const mul = comboMultiplier(s.combo);
  const raw = ORB_BASE[orb.kind];
  const gained = Math.round(raw * mul);
  s.base += raw;
  s.comboPts += gained - raw;
  if (inRisk(s, orb.x, orb.y)) {
    const bonus = orb.kind === 'gold' ? 1250 : orb.kind === 'rare' ? 800 : 400;
    s.riskPts += bonus;
    s.lastPopup = `+${bonus} strefa`;
  }
  if (orb.kind === 'gold' && mul >= 2) s.goldAtCombo2 = true;
  applyObjectives(s);
}

function scoreNearMiss(s: SimState, nx: number, ny: number, turned: boolean): void {
  const adj = wallAdjacent(s, nx, ny);
  if (adj <= 0) return;
  s.nearMisses += 1;
  let pts = 250;
  if (adj >= 2) pts = 600;
  if (inRisk(s, nx, ny)) pts = Math.max(pts, 800);
  if (turned && adj >= 1) {
    pts += 100;
    s.perfectTurns += 1;
  }
  s.riskPts += pts;
  applyObjectives(s);
}

function stepPlayer(s: SimState): void {
  const turned = s.queued !== null && s.queued !== s.dir;
  if (s.queued && s.queued !== OPPOSITE[s.dir]) s.dir = s.queued;
  s.queued = null;
  const head = s.body[0]!;
  const nx = head.x + DIR_VEC[s.dir].x;
  const ny = head.y + DIR_VEC[s.dir].y;
  if (!inBounds(nx, ny) || s.walls[ny]![nx] || onBody(s.body, nx, ny)) {
    s.died = true;
    s.phase = 'ko';
    s.survival = survivalBonus(s.elapsedMs, true);
    return;
  }
  const eat = s.orbs.findIndex((o) => o.x === nx && o.y === ny);
  s.body.unshift({ x: nx, y: ny });
  if (eat >= 0) {
    const orb = s.orbs.splice(eat, 1)[0]!;
    collect(s, orb);
  } else {
    s.body.pop();
  }
  s.steps += 1;
  scoreNearMiss(s, nx, ny, turned);
}

export function createSim(seed: number, phase: Extract<Phase, 'playing' | 'practice'>): SimState {
  const walls = buildWalls(seed);
  const body = spawnStart();
  const ghost = [
    { x: 14, y: 8 },
    { x: 13, y: 8 },
    { x: 12, y: 8 },
    { x: 11, y: 8 },
  ].filter((c) => !walls[c.y]![c.x]);
  if (ghost.length < 2) {
    ghost.length = 0;
    ghost.push({ x: 14, y: 4 }, { x: 13, y: 4 });
  }
  const pos = pickRisk(seed, 0);
  const s: SimState = {
    seed,
    kind: phase,
    phase,
    elapsedMs: 0,
    tickAcc: 0,
    dir: 'right',
    queued: null,
    body,
    walls,
    orbs: [],
    risk: { x: pos.x, y: pos.y, w: 3, h: 3, on: true },
    combo: 0,
    comboMs: 0,
    maxCombo: 0,
    orbsCollected: 0,
    orbsInCombo: 0,
    maxOrbsInCombo: 0,
    nearMisses: 0,
    goldAtCombo2: false,
    comboDropped: false,
    objSafe: false,
    objNear: false,
    objGold: false,
    base: 0,
    comboPts: 0,
    riskPts: 0,
    objective: 0,
    survival: 0,
    steps: 0,
    perfectTurns: 0,
    died: false,
    ghost,
    ghostDir: 'right',
    ghostScore: 0,
    lastPopup: '',
  };
  refillOrbs(s, mulberry32(hashSeed(seed ^ 0x51ed)));
  return s;
}

export function queueDir(s: SimState, dir: Dir): void {
  if (s.phase !== 'playing' && s.phase !== 'practice') return;
  if (dir === OPPOSITE[s.dir]) return;
  s.queued = dir;
}

export function tick(s: SimState, dt: number): void {
  if (s.phase !== 'playing' && s.phase !== 'practice') return;
  s.elapsedMs += dt;
  if (s.comboMs > 0) {
    s.comboMs -= dt;
    if (s.comboMs <= 0) {
      if (s.combo >= 2) s.comboDropped = true;
      s.combo = 0;
      s.orbsInCombo = 0;
      s.comboMs = 0;
    }
  }
  if (s.elapsedMs >= 75_000) {
    const slot = Math.floor((s.elapsedMs - 75_000) / 8000);
    const pos = pickRisk(s.seed, slot);
    s.risk.x = pos.x;
    s.risk.y = pos.y;
    s.risk.on = slot % 2 === 0;
  }
  s.tickAcc += dt;
  const interval = tickInterval(s.elapsedMs);
  while (s.tickAcc >= interval) {
    s.tickAcc -= interval;
    stepPlayer(s);
    if (s.died) break;
    stepGhost(s);
    refillOrbs(s, mulberry32(hashSeed(s.seed + s.steps * 17)));
  }
  s.survival = survivalBonus(s.elapsedMs, s.died);
  if (s.phase === 'playing' && s.elapsedMs >= MATCH_MS) {
    s.elapsedMs = MATCH_MS;
    s.survival = survivalBonus(MATCH_MS, false);
    s.phase = 'timeup';
  }
}

export function snapshotHud(s: SimState): HudSnap {
  const score = totalScore(s);
  const precision = s.steps > 0 ? s.orbsCollected / s.steps : 0;
  const perfect = !s.died && s.objSafe && s.objNear && s.objGold;
  const remain =
    s.phase === 'practice' ? MATCH_MS : Math.max(0, MATCH_MS - s.elapsedMs);
  return {
    phase: s.phase,
    kind: s.kind,
    score,
    ranked: rankedInt({
      score,
      perfect,
      objective: s.objective,
      riskPts: s.riskPts,
      maxCombo: s.maxCombo,
      precision,
      elapsedMs: s.elapsedMs,
    }),
    remainMs: remain,
    combo: s.combo,
    comboMul: comboMultiplier(Math.max(1, s.combo)),
    base: s.base,
    comboPts: s.comboPts,
    riskPts: s.riskPts,
    objective: s.objective,
    survival: s.survival,
    ghostScore: s.ghostScore,
    delta: score - s.ghostScore,
    body: s.body,
    ghost: s.ghost,
    walls: s.walls,
    orbs: s.orbs,
    risk: s.risk,
    dir: s.dir,
    ghostDir: s.ghostDir,
    objSafe: s.objSafe,
    objNear: s.objNear,
    objGold: s.objGold,
    perfect,
    died: s.died,
    lastPopup: s.lastPopup,
    arena: arenaPhase(s.elapsedMs),
  };
}

export function startFromUrl(practice: boolean): SimState {
  return createSim(roundSeed(), practice ? 'practice' : 'playing');
}

export interface HudSnap {
  phase: Phase;
  kind: Extract<Phase, 'playing' | 'practice'>;
  score: number;
  ranked: number;
  remainMs: number;
  combo: number;
  comboMul: number;
  base: number;
  comboPts: number;
  riskPts: number;
  objective: number;
  survival: number;
  ghostScore: number;
  delta: number;
  body: Cell[];
  ghost: Cell[];
  walls: boolean[][];
  orbs: Orb[];
  risk: SimState['risk'];
  dir: Dir;
  ghostDir: Dir;
  objSafe: boolean;
  objNear: boolean;
  objGold: boolean;
  perfect: boolean;
  died: boolean;
  lastPopup: string;
  arena: ReturnType<typeof arenaPhase>;
}
