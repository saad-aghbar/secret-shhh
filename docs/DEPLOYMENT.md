# Shhh deployment

Production host: **Vercel**. Canonical public URL: `NEXT_PUBLIC_APP_URL` (https, not localhost). Fill this before launch. Do not bake a domain into the repo.

Migrations never run on app boot. Run them explicitly.

## 1. Prerequisites

- Vercel project attached to this repo
- PostgreSQL (`DATABASE_URL`)
- Cloudflare R2 bucket (private, no public access)
- LiveKit Cloud project
- Optional: Supabase project for Realtime only
- Optional: YouTube Data API key (search). Paste-link works without it.

## 2. Environment variables

Copy names from `.env.example` into the Vercel project (Production). Required on Vercel production:

- `NEXT_PUBLIC_APP_URL` — `https://your-domain.example` (no trailing slash)
- `DATABASE_URL`
- `SESSION_SECRET`
- `AUTHORIZED_USER_1_PIN_HASH`
- `AUTHORIZED_USER_2_PIN_HASH`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- `LIVEKIT_URL` (`wss://….livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

Optional: display names, Supabase Realtime, YouTube/Spotify, size limits.

Never set `E2E_FORCE_CHAT_FAIL=1` or `STORAGE_PROVIDER=test` on Vercel production. Never put `service_role` or LiveKit secrets in `NEXT_PUBLIC_*`.

## 3. Supabase

If you use Supabase:

1. **Authentication → URL configuration:** Site URL = `NEXT_PUBLIC_APP_URL`. Redirect URLs = that origin only (plus `/login` if you add one). Remove localhost callbacks from production.
2. **Realtime:** broadcast is enough. The app does not use Supabase Auth.
3. **Table API:** the browser has the anon key. Revoke table grants so PostgREST cannot read your data:

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

`DATABASE_URL` should be the Postgres connection string used by Drizzle (session/server role). That role bypasses RLS; authorization is in the Next.js session.

## 4. Migrations

From a machine that can reach production Postgres:

```bash
pnpm db:migrate
```

Apply against the **production** `DATABASE_URL`. Do not reset the database. Backup first (see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)).

## 5. R2 / CORS

Keep the bucket **private**.

Browser uploads and downloads use signed URLs. Set CORS on the bucket to the production origin only:

- Allowed origins: `NEXT_PUBLIC_APP_URL` (example: `https://your-domain.example`)
- Allowed methods: `GET`, `PUT`, `HEAD`
- Allowed headers: `Content-Type`, `Authorization`, `x-amz-*`
- Expose headers: `ETag`
- Max age: `3600`
- Do **not** use `*`

Localhost CORS is only for development. Production must list the real https origin.

After changing `NEXT_PUBLIC_APP_URL`, update this CORS origin and rerun `pnpm r2:smoke` (from a machine with R2 env).

## 6. LiveKit

- URL must be `wss://….livekit.cloud` (HTTPS / WSS only)
- Keys stay server-side
- Tokens are minted by `/api/calls/[id]/token` for live calls only

## 7. Music providers

- YouTube playback is the official IFrame. No audio ripping.
- `YOUTUBE_API_KEY` is optional (search / counterpart matching). Quota applies.
- Spotify: optional client-credentials (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`). oEmbed fallback if unset.
- Apple Music: no secret. Public iTunes lookup.

## 8. Production build

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Vercel runs `pnpm build` / `pnpm start` equivalent. Local dry-run: `pnpm build && pnpm start`.

## 9. Deploy order

1. Backup the database
2. Set / verify Vercel env (including `NEXT_PUBLIC_APP_URL`)
3. `pnpm db:migrate` against production
4. Deploy the app on Vercel
5. Update R2 CORS if the origin changed
6. Smoke (section 10)

## 10. Production verification

- HTTPS loads
- `/api/health` returns `{ ok: true }`
- Login as both people
- Send text, photo, music, voice
- Audio and video call
- Privacy lock / unlock
- PWA install
- Sign out, then the other identity — no leftover draft/theme/player

## 11. Rollback

- **App:** redeploy the previous Vercel deployment.
- **Service worker:** caches are versioned (`shhh-shell-v3`). A bad worker waits for the next cold start (no `skipWaiting` in production). Users can hard-reload. Document that an in-call user is not force-reloaded.
- **Database:** only roll back a migration if it is actually reversible. Do not pretend a destructive migration can be undone. Restore from backup if needed.

## 12. Known limitations

- iOS may snapshot the last frame in the app switcher
- iOS may suspend background calls
- No Face ID on a generic PWA
- Installed name/icon cannot change dynamically
- YouTube availability is region/owner dependent
- Autoplay is browser-gated
- Offline music streaming is unavailable
- Web Share Target varies by platform
- HEVC/4K and some camera routes need a real iPhone check

## 13. Troubleshooting

| Symptom | Check |
| --- | --- |
| Build fails on env | `NEXT_PUBLIC_APP_URL` must be public https on Vercel production |
| Photo upload fails | R2 CORS origin must equal `NEXT_PUBLIC_APP_URL`; rerun `pnpm r2:smoke` |
| Calls fail | `LIVEKIT_URL` is `wss://`; keys not in `NEXT_PUBLIC_*` |
| Typing missing | Supabase URL + anon key; table grants still revoked |
| Stale UI after deploy | Cold start / hard reload; SW does not skipWaiting mid-session |
| Wrong identity flash | Confirm Sign out ran; local IndexedDB is cleared by `clearClientSession` |
