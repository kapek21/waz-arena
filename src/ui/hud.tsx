import type { JSX, ReactNode } from 'react';
import type { Dir } from '../core/types.js';
import type { HudSnap } from '../core/sim.js';
import { ASSET } from './art.js';

export type { HudSnap };

function fmt(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function StatsDeck({ snap, onPause }: { snap: HudSnap; onPause(): void }): JSX.Element {
  return (
    <div className="game-stats-deck pointer-events-auto flex items-center justify-between gap-2 px-1 py-1.5 text-white">
      <div className="toy-panel flex min-w-0 flex-1 items-baseline justify-between gap-2 px-3 py-2">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-[#78c8f8]">Score</div>
          <div className="text-2xl font-black leading-none text-[#fce874]">{snap.score}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] font-black uppercase tracking-wide text-[#78c8f8]">Ghost</div>
          <div className="text-xl font-black leading-none">{snap.ghostScore}</div>
        </div>
        <div className={`text-lg font-black ${snap.delta >= 0 ? 'text-[#40e878]' : 'text-[#e40058]'}`}>
          {snap.delta >= 0 ? '+' : ''}
          {snap.delta}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`toy-panel min-w-[5.5rem] px-3 py-2 text-center ${snap.arena === 'final' ? 'text-[#e40058]' : ''}`}>
          <div className="text-[11px] font-black uppercase tracking-wide text-[#78c8f8]">
            {snap.arena === 'final' ? 'Finał' : snap.phase === 'practice' ? 'Lab' : 'Czas'}
          </div>
          <div className="text-[1.65rem] font-black leading-none tabular-nums">
            {snap.phase === 'practice' ? '∞' : fmt(snap.remainMs)}
          </div>
        </div>
        <button type="button" className="toy-btn toy-btn-navy !min-w-[56px] px-3 text-xl" onClick={onPause} aria-label="Pauza">
          ❚❚
        </button>
      </div>
    </div>
  );
}

export function ControlDeck({
  snap,
  onDir,
}: {
  snap: HudSnap;
  onDir(dir: Dir): void;
}): JSX.Element {
  return (
    <div className="game-control-deck pointer-events-auto flex flex-col gap-2 px-1 py-1.5 text-white">
      <div className="flex items-stretch gap-2">
        <div className="toy-panel flex min-w-[72px] flex-col items-center px-2 py-1">
          <img src={ASSET.combo} alt="" className="h-8 w-8 object-contain" />
          <span className="text-[10px] font-black uppercase tracking-wide text-[#78c8f8]">Combo</span>
          <span className="text-lg font-black leading-none text-[#e40058]">×{snap.comboMul}</span>
        </div>
        <div className="toy-panel min-w-0 flex-1 px-2 py-1.5">
          <div className="flex flex-wrap gap-1 text-[11px] font-black uppercase">
            <span className="rounded-md bg-[#181028] px-1.5 py-0.5">Base {snap.base}</span>
            <span className="rounded-md bg-[#181028] px-1.5 py-0.5 text-[#e40058]">Combo {snap.comboPts}</span>
            <span className="rounded-md bg-[#e40058] px-1.5 py-0.5">Risk {snap.riskPts}</span>
            <span className="rounded-md bg-[#181028] px-1.5 py-0.5 text-[#fce874]">Cel {snap.objective}</span>
            <span className="rounded-md bg-[#181028] px-1.5 py-0.5 text-[#40e878]">Surv {snap.survival}</span>
          </div>
          <div className="mt-1 flex gap-2 text-[11px] font-black text-[#78c8f8]">
            <span>{snap.objSafe ? '✓' : '○'} 40 combo</span>
            <span>{snap.objNear ? '✓' : '○'} 8 near</span>
            <span>{snap.objGold ? '✓' : '○'} złoto ×2</span>
          </div>
        </div>
        <div className="toy-panel flex min-w-[72px] flex-col items-center px-2 py-1">
          <img src={ASSET.goal} alt="" className="h-8 w-8 object-contain" />
          <span className="text-[10px] font-black uppercase tracking-wide text-[#78c8f8]">Cel</span>
          <span className="text-lg font-black leading-none">{snap.objective}</span>
        </div>
      </div>
      <div className="coarse-only mx-auto grid w-[188px] grid-cols-3 grid-rows-2 gap-1">
        <span />
        <button type="button" className="toy-btn toy-btn-navy text-xl" onClick={() => onDir('up')} aria-label="Góra">
          ▲
        </button>
        <span />
        <button type="button" className="toy-btn toy-btn-navy text-xl" onClick={() => onDir('left')} aria-label="Lewo">
          ◀
        </button>
        <button type="button" className="toy-btn toy-btn-navy text-xl" onClick={() => onDir('down')} aria-label="Dół">
          ▼
        </button>
        <button type="button" className="toy-btn toy-btn-navy text-xl" onClick={() => onDir('right')} aria-label="Prawo">
          ▶
        </button>
      </div>
    </div>
  );
}

interface OverlayProps {
  snap: HudSnap | null;
  bosLocked: boolean;
  allowPractice: boolean;
  allowRestart: boolean;
  launchError: string | null;
  onStart(): void;
  onPractice(): void;
  onPause(): void;
  onRestart(): void;
}

export function Overlays(props: OverlayProps): JSX.Element {
  const { snap } = props;
  return (
    <>
      {(!snap || snap.phase === 'menu') && (
        <Menu
          launchError={props.launchError}
          bosLocked={props.bosLocked}
          allowPractice={props.allowPractice}
          onStart={props.onStart}
          onPractice={props.onPractice}
        />
      )}
      {snap?.phase === 'paused' && (
        <Modal title="Pauza" kicker="Chwila oddechu">
          <img src={ASSET.helper} alt="" className="mx-auto h-24 w-24 object-contain" />
          <button type="button" className="toy-btn toy-btn-green w-full px-6" onClick={props.onPause}>
            Wznów
          </button>
        </Modal>
      )}
      {(snap?.phase === 'timeup' || snap?.phase === 'ko') && (
        <Modal title={snap.phase === 'ko' ? 'Kolizja!' : 'Koniec pojedynku'} kicker="Super!">
          <img src={ASSET.head} alt="" className="mx-auto h-24 w-24 object-contain" />
          <p className="text-lg font-black text-[#102870]">Wynik {snap.score}</p>
          <p className="text-sm font-extrabold text-[#5c94fc]">Rank {snap.ranked}</p>
          {snap.perfect ? (
            <p className="rounded-full border-4 border-[#181028] bg-[#fce874] px-3 py-1 text-xs font-black uppercase">
              ★ Perfect Run
            </p>
          ) : null}
          <dl className="grid grid-cols-3 gap-1 text-xs font-black text-[#102870]">
            <div>
              <dt className="text-[#5c94fc]">Base</dt>
              <dd>{snap.base}</dd>
            </div>
            <div>
              <dt className="text-[#e40058]">Combo</dt>
              <dd>{snap.comboPts}</dd>
            </div>
            <div>
              <dt className="text-[#e40058]">Risk</dt>
              <dd>{snap.riskPts}</dd>
            </div>
          </dl>
          {props.allowRestart ? (
            <button type="button" className="toy-btn toy-btn-green w-full px-6" onClick={props.onRestart}>
              Jeszcze raz
            </button>
          ) : (
            <p className="text-sm font-extrabold text-[#181028]/60">Próba zakończona. Czekaj na platformę.</p>
          )}
        </Modal>
      )}
    </>
  );
}

function Modal({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#181028]/70 p-4">
      <div className="toy-card max-w-sm space-y-3 p-6 text-center">
        {kicker ? <p className="text-sm font-black uppercase tracking-wide text-[#e40058]">{kicker}</p> : null}
        <h2 className="text-3xl font-black leading-none text-[#102870]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Menu({
  onStart,
  onPractice,
  allowPractice,
  bosLocked,
  launchError,
}: {
  onStart(): void;
  onPractice(): void;
  bosLocked: boolean;
  allowPractice: boolean;
  launchError: string | null;
}): JSX.Element {
  return (
    <div className="toy-title pointer-events-auto absolute inset-0 z-20 flex items-end justify-center p-5 sm:items-center">
      <div className="mb-4 flex max-w-md flex-col items-center text-center sm:mb-0">
        <p className="mb-2 rounded-full border-4 border-[#181028] bg-[#fce874] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#181028] shadow-[0_5px_0_#181028]">
          ● 180s pojedynek
        </p>
        <h1 className="toy-wordmark text-5xl font-black uppercase sm:text-7xl">
          <span className="block text-[#fcfcfc]">Wąż</span>
          <span className="block text-[#fce874]">Arena</span>
        </h1>
        <p className="mt-3 rounded-md border-4 border-[#181028] bg-[#102870] px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-[#fcfcfc]">
          Zbieraj · Łącz · Ryzykuj
        </p>
        {launchError && <p className="mt-2 text-sm font-extrabold text-[#e40058]">{launchError}</p>}
        <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row">
          <button type="button" className="toy-btn w-full px-4 text-lg" disabled={bosLocked} onClick={onStart}>
            Graj 3 min ▶
          </button>
          {!bosLocked && allowPractice && (
            <button type="button" className="toy-btn toy-btn-yellow w-full px-4 text-lg" onClick={onPractice}>
              Practice Lab ⚙
            </button>
          )}
        </div>
        <p className="mt-4 text-xs font-extrabold leading-relaxed text-white/80">
          Strzałki / WASD · swipe na planszy
          <br />
          Ten sam seed mapy i koralików. Zero pay-to-win.
        </p>
      </div>
    </div>
  );
}
