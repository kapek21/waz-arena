# Deploy BoS games on Ceti (bos-games.bitbatle.com)

SSH access required (gamedev host from BOS WhatsApp). Without SSH, stop after local smoke.

## Layout

```
/srv/external-games/public/<slug>/     # static Vite build (index.html + assets)
/srv/external-games/backends/<slug>/   # copy of provider-backend for that game
```

## Per-game ports (local / suggested prod)

| Slug | Local provider PORT |
|------|---------------------|
| dices-2048-3d | 43080 (or packages/provider-backend) |
| deckbuilding | 43100 |
| grodowa-straz | 43101 |
| tower-defence | 43102 |
| fliper | 43103 |
| neon-circus-84 | 43104 |
| duck-shooter | 43105 |
| bubble-shooter | 43106 |
| fish-table | 43107 |
| vertical-tower | 43108 |
| balloon-rush | 43109 |
| deadeye-frontier | 43110 |
| micro-racer | 43111 |

Diamond Rush (dawniej Great Migration) i Armata — inny komputer, nie ten Mac. Nie deployować z tej maszyny.

## Steps

1. `npm run build` in game → upload `dist/` to `public/<slug>/`
2. Copy `provider-backend/` → `backends/<slug>/`, `npm install --omit=dev`
3. Production `.env`:
   - real `PROVIDER_KEY` / `SHARED_SECRET` from panel Gry zewnętrzne
   - `GAME_ORIGINS=https://bos-games.bitbatle.com`
   - `INTEGRATION_ALLOWED_HOSTS=bos.bitbatle.com,battleofskills.com`
   - `REQUIRE_HTTPS=true`
   - unique `PORT`
4. Reverse-proxy or same-origin path so the game can set `VITE_PROVIDER_BACKEND_URL` at **build time** to the public backend URL (e.g. `https://bos-games.bitbatle.com/api/<slug>` or dedicated port behind nginx).
5. `scripts/start.sh` — ask Bartek to add to boot
6. Panel: register game URL `https://bos-games.bitbatle.com/<slug>/`
7. Create duel: źródło = Gra zewnętrzna
8. Test as **player** + tokens

## Local DoD (done without SSH)

```bash
cd <game>/provider-backend
npm install && npm run mock:bos   # :45090
npm start                        # game port from .env
npm run smoke
```

Template source of truth: `fundusz/_bos-provider-template/`
