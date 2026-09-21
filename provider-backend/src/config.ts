function csv(value: string | undefined): string[] {
  return (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

export interface ProviderConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  providerKey: string;
  sharedSecret: string;
  gameOrigins: string[];
  integrationAllowedHosts: string[];
  requireHttps: boolean;
  upstreamTimeoutMs: number;
  upstreamMaxRetries: number;
  gameSlug: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const providerKey = env.PROVIDER_KEY ?? '';
  const sharedSecret = env.SHARED_SECRET ?? '';
  const missing: string[] = [];
  if (!providerKey) missing.push('PROVIDER_KEY');
  if (!sharedSecret) missing.push('SHARED_SECRET');
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}. Copy .env.example → .env`);
  }
  return {
    port: Number(env.PORT) || 43080,
    nodeEnv,
    isProduction,
    providerKey,
    sharedSecret,
    gameOrigins: csv(env.GAME_ORIGINS).length ? csv(env.GAME_ORIGINS) : ['http://localhost:5173'],
    integrationAllowedHosts: csv(env.INTEGRATION_ALLOWED_HOSTS).length
      ? csv(env.INTEGRATION_ALLOWED_HOSTS)
      : isProduction
        ? ['battleofskills.com', 'bos.bitbatle.com']
        : ['battleofskills.com', 'bos.bitbatle.com', 'localhost', '127.0.0.1'],
    requireHttps: bool(env.REQUIRE_HTTPS, isProduction),
    upstreamTimeoutMs: Number(env.UPSTREAM_TIMEOUT_MS) || 8000,
    upstreamMaxRetries: Number(env.UPSTREAM_MAX_RETRIES) || 2,
    gameSlug: env.GAME_SLUG ?? 'game',
  };
}

export function validateIntegrationBaseUrl(
  raw: string,
  config: ProviderConfig,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (config.requireHttps && url.protocol !== 'https:') return { ok: false, reason: 'https_required' };
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'invalid_scheme' };
  const hostAllowed = config.integrationAllowedHosts.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
  );
  if (!hostAllowed) return { ok: false, reason: 'host_not_allowed' };
  return { ok: true, url };
}
