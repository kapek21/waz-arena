import { z } from 'zod';

export const BosAuthorizeResponseSchema = z.object({
  allowed: z.boolean(),
  gameId: z.string().optional(),
  gameName: z.string().optional(),
  externalGameId: z.string().optional(),
  accountId: z.string().optional(),
  username: z.string().optional(),
  score: z.number().int().nonnegative().optional(),
  finished: z.boolean().optional(),
});
export type BosAuthorizeResponse = z.infer<typeof BosAuthorizeResponseSchema>;

export const BosScorePayloadSchema = z.object({
  score: z.number().int().nonnegative(),
  finished: z.boolean(),
});
export type BosScorePayload = z.infer<typeof BosScorePayloadSchema>;

export const BosRateLimitBodySchema = z.object({
  retryAfterSeconds: z.number().nonnegative().optional(),
  minIntervalSeconds: z.number().nonnegative().optional(),
});

export type ProviderAuthorizeResult = {
  allowed: boolean;
  gameName?: string;
  username?: string;
  score?: number;
  finished?: boolean;
  reason?: string;
};

export const ProviderScoreRequestSchema = z.object({
  session: z.string().min(1),
  integrationBaseUrl: z.string().url(),
  score: z.number().int().nonnegative(),
  finished: z.boolean(),
});

export type ProviderScoreResult = {
  ok: boolean;
  throttled?: boolean;
  retryAfterSeconds?: number;
  closed?: boolean;
  error?: string;
};

export const BOS_ERROR = {
  MISSING_LAUNCH_PARAMS: 'missing_launch_params',
  AUTHORIZE_FAILED: 'authorize_failed',
  SESSION_FINISHED: 'session_finished',
  TOO_MANY_SCORE_UPDATES: 'too_many_score_updates',
  INTEGRATION_HOST_NOT_ALLOWED: 'integration_host_not_allowed',
  UPSTREAM_ERROR: 'upstream_error',
} as const;

export const BOS_HEADERS = {
  KEY: 'X-External-Game-Key',
  TIMESTAMP: 'X-External-Game-Timestamp',
  SIGNATURE: 'X-External-Game-Signature',
} as const;

export const BOS_MIN_SCORE_INTERVAL_SECONDS = 3;
