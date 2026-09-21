import express from 'express';
import type { Request, Response } from 'express';
import { BOS_ERROR, ProviderScoreRequestSchema, type ProviderAuthorizeResult, type ProviderScoreResult } from './bos-contract.js';
import { validateIntegrationBaseUrl, type ProviderConfig } from './config.js';
import { BattleOfSkillsClient, UpstreamError } from './battle-of-skills-client.js';
import { SessionThrottle } from './throttle.js';
import { log, shortSession } from './logger.js';

export interface RouterDeps {
  config: ProviderConfig;
  client: BattleOfSkillsClient;
  throttle: SessionThrottle;
}

export function createRouter(deps: RouterDeps): express.Router {
  const { config, client, throttle } = deps;
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'provider-backend', game: config.gameSlug });
  });

  router.get('/authorize', async (req: Request, res: Response) => {
    const session = typeof req.query.session === 'string' ? req.query.session : '';
    const integrationBaseUrl =
      typeof req.query.integrationBaseUrl === 'string' ? req.query.integrationBaseUrl : '';
    if (!session || !integrationBaseUrl) {
      res.status(400).json({ allowed: false, reason: BOS_ERROR.MISSING_LAUNCH_PARAMS });
      return;
    }
    const check = validateIntegrationBaseUrl(integrationBaseUrl, config);
    if (!check.ok) {
      res.status(400).json({ allowed: false, reason: BOS_ERROR.INTEGRATION_HOST_NOT_ALLOWED });
      return;
    }
    try {
      const upstream = await client.authorize(integrationBaseUrl, session);
      const result: ProviderAuthorizeResult = {
        allowed: upstream.allowed === true && upstream.finished !== true,
      };
      if (upstream.gameName !== undefined) result.gameName = upstream.gameName;
      if (upstream.username !== undefined) result.username = upstream.username;
      if (upstream.score !== undefined) result.score = upstream.score;
      if (upstream.finished !== undefined) result.finished = upstream.finished;
      if (upstream.finished === true) {
        result.reason = BOS_ERROR.SESSION_FINISHED;
        throttle.markClosed(session);
      } else if (upstream.allowed !== true) {
        result.reason = BOS_ERROR.AUTHORIZE_FAILED;
      }
      res.json(result);
    } catch (err) {
      const status = err instanceof UpstreamError ? err.httpStatus : undefined;
      log.error('authorize upstream error', { session: shortSession(session), status });
      res.status(502).json({ allowed: false, reason: BOS_ERROR.UPSTREAM_ERROR });
    }
  });

  router.post('/score', async (req: Request, res: Response) => {
    const parsed = ProviderScoreRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const body: ProviderScoreResult = { ok: false, error: BOS_ERROR.MISSING_LAUNCH_PARAMS };
      res.status(400).json(body);
      return;
    }
    const { session, integrationBaseUrl, score, finished } = parsed.data;
    const check = validateIntegrationBaseUrl(integrationBaseUrl, config);
    if (!check.ok) {
      res.status(400).json({ ok: false, error: BOS_ERROR.INTEGRATION_HOST_NOT_ALLOWED } satisfies ProviderScoreResult);
      return;
    }
    if (throttle.isClosed(session)) {
      res.status(409).json({ ok: false, closed: true, error: BOS_ERROR.SESSION_FINISHED } satisfies ProviderScoreResult);
      return;
    }
    if (!finished) {
      const gate = throttle.canSendPartial(session);
      if (!gate.allowed) {
        res.status(202).json({
          ok: false,
          throttled: true,
          retryAfterSeconds: gate.retryAfterSeconds,
        } satisfies ProviderScoreResult);
        return;
      }
    }
    try {
      const outcome = await client.postScore(integrationBaseUrl, session, { score, finished });
      if (outcome.status === 'ok') {
        if (finished) throttle.markClosed(session);
        else throttle.recordPartialSent(session);
        const body: ProviderScoreResult = { ok: true };
        if (finished) body.closed = true;
        res.json(body);
        return;
      }
      if (outcome.status === 'rate_limited') {
        res.status(429).json({
          ok: false,
          throttled: true,
          retryAfterSeconds: outcome.retryAfterSeconds,
          error: BOS_ERROR.TOO_MANY_SCORE_UPDATES,
        } satisfies ProviderScoreResult);
        return;
      }
      throttle.markClosed(session);
      res.status(409).json({ ok: false, closed: true, error: BOS_ERROR.SESSION_FINISHED } satisfies ProviderScoreResult);
    } catch (err) {
      const status = err instanceof UpstreamError ? err.httpStatus : undefined;
      log.error('score upstream error', { session: shortSession(session), status });
      res.status(502).json({ ok: false, error: BOS_ERROR.UPSTREAM_ERROR } satisfies ProviderScoreResult);
    }
  });

  return router;
}
