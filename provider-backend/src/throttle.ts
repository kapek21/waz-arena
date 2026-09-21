import { BOS_MIN_SCORE_INTERVAL_SECONDS } from './bos-contract.js';

export class SessionThrottle {
  private readonly lastPartialMs = new Map<string, number>();
  private readonly closed = new Set<string>();
  private readonly minIntervalMs: number;

  constructor(minIntervalSeconds: number = BOS_MIN_SCORE_INTERVAL_SECONDS) {
    this.minIntervalMs = minIntervalSeconds * 1000;
  }

  canSendPartial(session: string, nowMs: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const last = this.lastPartialMs.get(session);
    if (last === undefined) return { allowed: true, retryAfterSeconds: 0 };
    const elapsed = nowMs - last;
    if (elapsed >= this.minIntervalMs) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.ceil((this.minIntervalMs - elapsed) / 1000) };
  }

  recordPartialSent(session: string, nowMs: number = Date.now()): void {
    this.lastPartialMs.set(session, nowMs);
  }

  markClosed(session: string): void {
    this.closed.add(session);
    this.lastPartialMs.delete(session);
  }

  isClosed(session: string): boolean {
    return this.closed.has(session);
  }

  sweep(maxAgeMs: number, nowMs: number = Date.now()): void {
    for (const [session, ts] of this.lastPartialMs) {
      if (nowMs - ts > maxAgeMs) this.lastPartialMs.delete(session);
    }
  }
}
