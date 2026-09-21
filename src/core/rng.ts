export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(n: number): number {
  return Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
}

export function roundSeed(): number {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('seed');
  if (raw && /^\d+$/.test(raw)) return Number(raw) >>> 0;
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

export function pickInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
