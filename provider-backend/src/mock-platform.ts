import express from 'express';
import type { Request, Response } from 'express';
import { loadEnvFile } from './load-env.js';
import { BOS_HEADERS } from './bos-contract.js';
import { verifySignatureHeader } from './hmac.js';
import { log, shortSession } from './logger.js';

loadEnvFile();

const PORT = Number(process.env.MOCK_BOS_PORT) || 45090;
const PROVIDER_KEY = process.env.PROVIDER_KEY ?? 'dev-provider-key';
const SHARED_SECRET = process.env.SHARED_SECRET ?? 'dev-shared-secret';
const MIN_INTERVAL_SECONDS = 3;
const MAX_CLOCK_SKEW_MS = 300_000;
const BASE = '/api/integration/external-games';

interface SessionState {
  bestScore: number;
  finished: boolean;
  lastPartialMs: number | null;
}
const sessions = new Map<string, SessionState>();
function stateFor(session: string): SessionState {
  let s = sessions.get(session);
  if (!s) {
    s = { bestScore: 0, finished: false, lastPartialMs: null };
    sessions.set(session, s);
  }
  return s;
}

interface RawBodyRequest extends Request {
  rawBody?: string;
}

const app = express();
app.disable('x-powered-by');
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString('utf8');
    },
  }),
);

function verify(req: RawBodyRequest): { ok: true } | { ok: false; reason: string } {
  const key = req.header(BOS_HEADERS.KEY);
  const timestamp = req.header(BOS_HEADERS.TIMESTAMP);
  const signatureHeader = req.header(BOS_HEADERS.SIGNATURE);
  if (!key || !timestamp || !signatureHeader) return { ok: false, reason: 'missing_headers' };
  if (key !== PROVIDER_KEY) return { ok: false, reason: 'bad_key' };
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: 'stale_timestamp' };
  }
  const valid = verifySignatureHeader({
    timestamp,
    method: req.method,
    pathWithQuery: req.originalUrl,
    body: req.rawBody ?? '',
    sharedSecret: SHARED_SECRET,
    signatureHeader,
  });
  return valid ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

app.get(`${BASE}/sessions/:session/authorize`, (req: Request, res: Response) => {
  const v = verify(req as RawBodyRequest);
  if (!v.ok) {
    res.status(401).json({ error: 'invalid_signature', reason: v.reason });
    return;
  }
  const session = req.params.session ?? '';
  const st = stateFor(session);
  res.json({
    allowed: true,
    gameName: 'Mock BattleOfSkills Duel',
    username: 'MockPlayer',
    score: st.bestScore,
    finished: st.finished,
  });
});

app.post(`${BASE}/sessions/:session/score`, (req: Request, res: Response) => {
  const v = verify(req as RawBodyRequest);
  if (!v.ok) {
    res.status(401).json({ error: 'invalid_signature', reason: v.reason });
    return;
  }
  const session = req.params.session ?? '';
  const st = stateFor(session);
  const { score, finished } = (req.body ?? {}) as { score?: number; finished?: boolean };
  if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
    res.status(400).json({ error: 'invalid_score' });
    return;
  }
  if (st.finished) {
    res.status(409).json({ error: 'session_finished' });
    return;
  }
  if (finished !== true) {
    const now = Date.now();
    if (st.lastPartialMs !== null && now - st.lastPartialMs < MIN_INTERVAL_SECONDS * 1000) {
      res.status(429).json({
        error: 'too_many_score_updates',
        retryAfterSeconds: Math.ceil((MIN_INTERVAL_SECONDS * 1000 - (now - st.lastPartialMs)) / 1000),
        minIntervalSeconds: MIN_INTERVAL_SECONDS,
      });
      return;
    }
    st.lastPartialMs = now;
  }
  st.bestScore = Math.max(st.bestScore, score);
  if (finished === true) st.finished = true;
  log.info('mock score accepted', { session: shortSession(session), score, finished: finished === true });
  res.json({ accepted: true, bestScore: st.bestScore, finished: st.finished });
});

app.listen(PORT, () => {
  log.info('mock BattleOfSkills platform listening', {
    port: PORT,
    integrationBaseUrl: `http://localhost:${PORT}${BASE}`,
  });
});
