# BoS provider-backend template

Standalone HMAC bridge between a game iframe and Battle of Skills / BitBatle.

## Local

```bash
cp .env.example .env
npm install
npm run mock:bos   # terminal 1 — mock platform :45090
npm start          # terminal 2 — provider :43080
npm run smoke      # terminal 3 — authorize + final score
```

Mock integration URL for game launch:

`http://localhost:45090/api/integration/external-games`

Game iframe must call **this** backend only (`VITE_PROVIDER_BACKEND_URL=http://localhost:43080`), never `bos.bitbatle.com` from the browser.

## Copy into a game

```bash
./scripts/copy-to-game.sh ../deckbuilding 43100 deckbuilding
```

## Deploy on Ceti (bos-games.bitbatle.com)

1. Front build → `/srv/external-games/public/<slug>/`
2. This backend → e.g. `/srv/external-games/backends/<slug>/`
3. Set production `.env`: real `PROVIDER_KEY` / `SHARED_SECRET`, `GAME_ORIGINS=https://bos-games.bitbatle.com`, `INTEGRATION_ALLOWED_HOSTS=bos.bitbatle.com,battleofskills.com`, `REQUIRE_HTTPS=true`, unique `PORT`
4. `scripts/start.sh` — ask Bartek to add to boot sequence
5. Panel: register external game URL + create duel „Gra zewnętrzna”
6. Test as **player** account with tokens

## Security

- `SHARED_SECRET` never in frontend / git / logs
- CORS allowlist = game origins only
