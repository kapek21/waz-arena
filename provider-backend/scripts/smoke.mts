/**
 * Local smoke: expects mock:bos on MOCK_BOS_PORT and provider on PORT.
 * Run: npm run mock:bos &  then  npm start &  then  npm run smoke
 */
const PORT = Number(process.env.PORT) || 43080;
const MOCK = Number(process.env.MOCK_BOS_PORT) || 45090;
const session = `smoke-${Date.now()}`;
const integrationBaseUrl = `http://127.0.0.1:${MOCK}/api/integration/external-games`;

async function main() {
  const health = await fetch(`http://127.0.0.1:${PORT}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);
  const authUrl =
    `http://127.0.0.1:${PORT}/authorize?session=${encodeURIComponent(session)}` +
    `&integrationBaseUrl=${encodeURIComponent(integrationBaseUrl)}`;
  const auth = await fetch(authUrl);
  const authJson = (await auth.json()) as { allowed?: boolean };
  if (!auth.ok || authJson.allowed !== true) throw new Error(`authorize failed: ${JSON.stringify(authJson)}`);
  const scoreRes = await fetch(`http://127.0.0.1:${PORT}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, integrationBaseUrl, score: 42, finished: true }),
  });
  const scoreJson = await scoreRes.json();
  if (!scoreRes.ok || !(scoreJson as { ok?: boolean }).ok) {
    throw new Error(`score failed: ${JSON.stringify(scoreJson)}`);
  }
  console.log('SMOKE OK', { session, authJson, scoreJson });
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
