import './index.css';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSim, queueDir, snapshotHud, tick } from './core/sim.js';
import type { SimState } from './core/types.js';
import { roundSeed } from './core/rng.js';
import { COLS, ROWS } from './core/types.js';
import { drawBoard } from './render/board-canvas.js';
import { attachKeyboard, attachTouch } from './input/controls.js';
import { ControlDeck, Overlays, StatsDeck, type HudSnap } from './ui/hud.js';
import { preloadAssets } from './ui/art.js';
import { getPlatform } from './platform/bos-platform.js';

function cellSize(frameW: number, frameH: number): number {
  const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 720;
  const cap = coarse ? 22 : 28;
  return Math.max(10, Math.min(cap, Math.floor(Math.min(frameW / COLS, frameH / ROWS))));
}

function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimState | null>(null);
  const reported = useRef(false);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const platform = getPlatform();
  const playing = hud?.phase === 'playing' || hud?.phase === 'practice';

  useEffect(() => {
    preloadAssets();
  }, []);

  useEffect(() => {
    const off = platform.onLaunchError((e) => setErr(e.message));
    void platform.ready().catch(() => undefined);
    return off;
  }, [platform]);

  useEffect(() => {
    const offKey = attachKeyboard(() => simRef.current);
    const el = boardWrapRef.current;
    const offTouch = el ? attachTouch(el, () => simRef.current) : () => undefined;
    return () => {
      offKey();
      offTouch();
    };
  }, [playing]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const fit = (): void => {
      const cell = cellSize(stage.clientWidth, stage.clientHeight);
      canvas.width = COLS * cell;
      canvas.height = ROWS * cell;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(50, now - last);
      last = now;
      const sim = simRef.current;
      if (sim && (sim.phase === 'playing' || sim.phase === 'practice')) {
        tick(sim, dt);
        if (sim.phase === 'playing') platform.reportPartial(snapshotHud(sim).ranked);
      }
      if (sim && (sim.phase === 'timeup' || sim.phase === 'ko') && !reported.current) {
        reported.current = true;
        platform.reportFinal(snapshotHud(sim).ranked);
      }
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current && sim) {
        const snap = snapshotHud(sim);
        drawBoard(ctx, canvasRef.current.width, canvasRef.current.height, snap);
        setHud(snap);
      } else if (!sim) {
        setHud(null);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [platform]);

  const start = (practice: boolean): void => {
    if (platform.attemptLocked) return;
    reported.current = false;
    simRef.current = createSim(roundSeed(), practice ? 'practice' : 'playing');
  };

  const onPause = (): void => {
    const s = simRef.current;
    if (!s) return;
    if (s.phase === 'playing' || s.phase === 'practice') s.phase = 'paused';
    else if (s.phase === 'paused') s.phase = s.kind;
  };

  return (
    <div className="toy-sky fixed inset-0">
      <div className="toy-shell">
        {playing && hud && <StatsDeck snap={hud} onPause={onPause} />}
        <div ref={stageRef} className="game-stage">
          <div ref={boardWrapRef} className="game-frame">
            <canvas ref={canvasRef} width={400} height={320} />
          </div>
        </div>
        {playing && hud && (
          <ControlDeck
            snap={hud}
            onDir={(dir) => {
              if (simRef.current) queueDir(simRef.current, dir);
            }}
          />
        )}
      </div>
      <Overlays
        snap={hud}
        bosLocked={platform.attemptLocked}
        allowPractice={platform.mode !== 'bos'}
        allowRestart={platform.mode !== 'bos'}
        launchError={err}
        onStart={() => start(false)}
        onPractice={() => start(true)}
        onPause={onPause}
        onRestart={() => start(hud?.kind === 'practice')}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
