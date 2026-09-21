import { BattleOfSkillsSession, detectBattleOfSkillsLaunch } from './battle-of-skills';

export type PlatformMode = 'bos' | 'metabot' | 'standalone';

export interface LaunchError {
  code: string;
  title: string;
  message: string;
}

class PlatformImpl {
  readonly mode: PlatformMode;
  readonly embedded: boolean;
  private bos: BattleOfSkillsSession | null = null;
  private bosParamsMissing: string[] | null = null;
  private launchErr: LaunchError | null = null;
  private readonly errListeners = new Set<(e: LaunchError) => void>();
  private opponent: string | null = null;

  constructor() {
    const detection = detectBattleOfSkillsLaunch();
    if (detection.kind === 'launch') {
      this.mode = 'bos';
      this.embedded = true;
      this.bos = new BattleOfSkillsSession(detection.params);
    } else if (detection.kind === 'invalid') {
      this.mode = 'bos';
      this.embedded = true;
      this.bosParamsMissing = detection.missing;
    } else if (typeof window !== 'undefined' && window.parent !== window) {
      this.mode = 'metabot';
      this.embedded = true;
    } else {
      this.mode = 'standalone';
      this.embedded = false;
    }
  }

  opponentName(): string | null {
    return this.opponent;
  }

  async ready(): Promise<void> {
    if (this.bosParamsMissing) {
      this.fail({
        code: 'missing_launch_params',
        title: 'Brak parametrów startowych',
        message: `Brak: ${this.bosParamsMissing.join(', ')}`,
      });
      throw new Error('missing_launch_params');
    }
    if (!this.bos) return;
    const auth = await this.bos.authorize();
    if (!auth.allowed) {
      const finished = auth.reason === 'session_finished' || this.bos.isClosed;
      this.fail({
        code: auth.reason ?? 'authorize_failed',
        title: finished ? 'Sesja zakończona' : 'Brak autoryzacji',
        message: finished ? 'Sesja już zakończona.' : 'Autoryzacja BoS nieudana.',
      });
      throw new Error(auth.reason ?? 'authorize_failed');
    }
    if (auth.username) this.opponent = auth.username;
  }

  get attemptLocked(): boolean {
    return this.bos?.attemptLocked ?? false;
  }

  reportPartial(score: number): void {
    this.bos?.reportPartial(score);
  }

  reportFinal(score: number): void {
    if (this.bos) void this.bos.reportFinal(score);
  }

  onLaunchError(cb: (e: LaunchError) => void): () => void {
    this.errListeners.add(cb);
    if (this.launchErr) cb(this.launchErr);
    return () => this.errListeners.delete(cb);
  }

  private fail(e: LaunchError): void {
    this.launchErr = e;
    for (const cb of this.errListeners) cb(e);
  }
}

let singleton: PlatformImpl | null = null;
export function getPlatform(): PlatformImpl {
  if (!singleton) singleton = new PlatformImpl();
  return singleton;
}
