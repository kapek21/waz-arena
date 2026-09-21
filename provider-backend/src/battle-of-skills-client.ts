import {
  BOS_HEADERS,
  BosAuthorizeResponseSchema,
  BosRateLimitBodySchema,
  type BosAuthorizeResponse,
  type BosScorePayload,
} from './bos-contract.js';
import type { ProviderConfig } from './config.js';
import { pathWithQueryFromUrl, signRequest } from './hmac.js';
import { log, shortSession } from './logger.js';

export type ScoreOutcome =
  | { status: 'ok' }
  | { status: 'rate_limited'; retryAfterSeconds: number; minIntervalSeconds?: number }
  | { status: 'finished' };

export class UpstreamError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export class BattleOfSkillsClient {
  constructor(private readonly config: ProviderConfig) {}

  private buildHeaders(method: string, fullUrl: string, body: string): Record<string, string> {
    const timestamp = new Date().toISOString();
    const { signatureHeader } = signRequest({
      timestamp,
      method,
      pathWithQuery: pathWithQueryFromUrl(fullUrl),
      body,
      sharedSecret: this.config.sharedSecret,
    });
    return {
      [BOS_HEADERS.KEY]: this.config.providerKey,
      [BOS_HEADERS.TIMESTAMP]: timestamp,
      [BOS_HEADERS.SIGNATURE]: signatureHeader,
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.upstreamTimeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async authorize(integrationBaseUrl: string, session: string): Promise<BosAuthorizeResponse> {
    const url = `${integrationBaseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(session)}/authorize`;
    const headers = { Accept: 'application/json', ...this.buildHeaders('GET', url, '') };
    const res = await this.withRetries(() => this.fetchWithTimeout(url, { method: 'GET', headers }));
    if (!res.ok) throw new UpstreamError(`authorize failed (${res.status})`, res.status);
    const parsed = BosAuthorizeResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new UpstreamError('authorize response failed validation');
    log.info('authorize ok', { session: shortSession(session), allowed: parsed.data.allowed });
    return parsed.data;
  }

  async postScore(integrationBaseUrl: string, session: string, payload: BosScorePayload): Promise<ScoreOutcome> {
    const url = `${integrationBaseUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(session)}/score`;
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.buildHeaders('POST', url, body),
    };
    const res = await this.withRetries(() => this.fetchWithTimeout(url, { method: 'POST', headers, body }));
    if (res.status === 429) {
      const parsed = BosRateLimitBodySchema.safeParse(await this.safeJson(res));
      const retryAfterSeconds = parsed.success ? parsed.data.retryAfterSeconds ?? 3 : 3;
      const minIntervalSeconds = parsed.success ? parsed.data.minIntervalSeconds : undefined;
      return minIntervalSeconds !== undefined
        ? { status: 'rate_limited', retryAfterSeconds, minIntervalSeconds }
        : { status: 'rate_limited', retryAfterSeconds };
    }
    if (res.status === 409) return { status: 'finished' };
    if (!res.ok) throw new UpstreamError(`score failed (${res.status})`, res.status);
    log.info('score accepted', { session: shortSession(session), finished: payload.finished, score: payload.score });
    return { status: 'ok' };
  }

  private async safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }

  private async withRetries(attempt: () => Promise<Response>): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i <= this.config.upstreamMaxRetries; i++) {
      try {
        const res = await attempt();
        if (res.status >= 500 && i < this.config.upstreamMaxRetries) {
          await delay(150 * (i + 1));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (i < this.config.upstreamMaxRetries) {
          await delay(150 * (i + 1));
          continue;
        }
      }
    }
    throw new UpstreamError(
      lastErr instanceof Error ? `upstream request failed: ${lastErr.message}` : 'upstream request failed',
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
