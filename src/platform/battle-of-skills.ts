// BattleOfSkills iframe-side adapter for Kuźnia Artefaktów.
//
// Mirrors packages/game/src/bridge/battle-of-skills.ts: the iframe talks ONLY to
// OUR provider backend (never to BattleOfSkills directly, never touching the shared
// secret), authorizes the session, reports throttled partial scores + one final,
// and notifies the BattleOfSkills parent window via postMessage after each save.

const BITBATLE_SCORE_EVENT = 'bitbatle.externalGame.score' as const;
const BITBATLE_FINISHED_EVENT = 'bitbatle.externalGame.finished' as const;
const MIN_PARTIAL_INTERVAL_MS = 3000;

export interface BosLaunchParams {
  session: string;
  integrationBaseUrl: string;
  gameId?: string;
  apiBaseUrl?: string;
}

export type BosDetection =
  | { kind: 'none' }
  | { kind: 'invalid'; missing: string[] }
  | { kind: 'launch'; params: BosLaunchParams };

export interface BosAuthorizeResult {
  allowed: boolean;
  username?: string;
  score?: number;
  finished?: boolean;
  reason?: string;
}

function isHttpUrl(v: string | undefined): v is string {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectBattleOfSkillsLaunch(search: string = window.location.search): BosDetection {
  const q = new URLSearchParams(search);
  const session = q.get('session') ?? undefined;
  const integrationBaseUrl = q.get('integrationBaseUrl') ?? undefined;
  const gameId = q.get('gameId') ?? undefined;
  const apiBaseUrl = q.get('apiBaseUrl') ?? undefined;

  if (!session && !integrationBaseUrl) return { kind: 'none' };

  const missing: string[] = [];
  if (!session) missing.push('session');
  if (!isHttpUrl(integrationBaseUrl)) missing.push('integrationBaseUrl');
  if (missing.length) return { kind: 'invalid', missing };

  return {
    kind: 'launch',
    params: {
      session: session!,
      integrationBaseUrl: integrationBaseUrl!,
      ...(gameId ? { gameId } : {}),
      ...(isHttpUrl(apiBaseUrl) ? { apiBaseUrl } : {}),
    },
  };
}

function providerBaseUrl(): string {
  const raw = (import.meta.env.VITE_PROVIDER_BACKEND_URL as string | undefined)?.trim() ?? '';
  return raw.replace(/\/$/, '');
}

export class BattleOfSkillsSession {
  private readonly base = providerBaseUrl();
  private closed = false;
  private lastPartialMs = 0;
  private inFlight = false;

  constructor(private readonly params: BosLaunchParams) {}

  get isClosed(): boolean {
    return this.closed;
  }

  /** True after a final score is sent, or the session was already finished. Games must freeze. */
  get attemptLocked(): boolean {
    return this.closed;
  }

  /** Call from the game after reportFinal so UI can freeze even if the network is slow. */
  lockAttempt(): void {
    this.closed = true;
  }

  async authorize(): Promise<BosAuthorizeResult> {
    const url =
      `${this.base}/authorize?session=${encodeURIComponent(this.params.session)}` +
      `&integrationBaseUrl=${encodeURIComponent(this.params.integrationBaseUrl)}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const json = (await res.json().catch(() => ({}))) as BosAuthorizeResult;
      if (typeof json?.allowed !== 'boolean') return { allowed: false, reason: 'authorize_failed' };
      if (json.finished) this.closed = true;
      return json;
    } catch {
      return { allowed: false, reason: 'authorize_failed' };
    }
  }

  reportPartial(score: number): void {
    if (this.closed || this.inFlight) return;
    const now = Date.now();
    if (now - this.lastPartialMs < MIN_PARTIAL_INTERVAL_MS) return;
    this.lastPartialMs = now;
    void this.send(score, false);
  }

  async reportFinal(score: number): Promise<void> {
    if (this.closed) return;
    this.lockAttempt();
    await this.send(score, true);
  }

  private async send(score: number, finished: boolean): Promise<void> {
    this.inFlight = true;
    try {
      const res = await fetch(`${this.base}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          session: this.params.session,
          integrationBaseUrl: this.params.integrationBaseUrl,
          score: Math.max(0, Math.round(score)),
          finished,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; closed?: boolean };
      if (json?.closed) this.closed = true;
      if (json?.ok) this.notifyParent(Math.max(0, Math.round(score)), finished);
    } catch {
      /* score save is best-effort; keep the game playable */
    } finally {
      this.inFlight = false;
    }
  }

  private notifyParent(score: number, finished: boolean): void {
    const targetOrigin = this.params.apiBaseUrl;
    if (!targetOrigin || window.parent === window) return;
    const message = finished
      ? { type: BITBATLE_FINISHED_EVENT, score, finished: true as const }
      : { type: BITBATLE_SCORE_EVENT, score, finished: false as const };
    try {
      window.parent.postMessage(message, targetOrigin);
    } catch {
      /* ignore */
    }
  }
}
