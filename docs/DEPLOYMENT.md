# Shhh deployment

Production host: **Vercel**.

Canonical public URL is `NEXT_PUBLIC_APP_URL`. The initial production origin is:

`https://shhh-one-zeta.vercel.app`

Do not bake that domain into application source. Change the environment variable (and R2 CORS) if a custom domain is added later.

Migrations never run on app boot. Run them explicitly against the **hosted** production `DATABASE_URL`.

## 1. Prerequisites

- Existing Vercel project **Shhh** (do not create a second project)
- Hosted PostgreSQL (`DATABASE_URL`) — not `localhost`
- Cloudflare R2 bucket (private, no public access)
- LiveKit Cloud project
- Optional: Supabase project for Realtime only (this app does not use Supabase Auth)
- Optional: YouTube Data API key (search). Paste-link works without it.

## 2. Environment variables

Copy names from `.env.example` into Vercel → Shhh → Settings → Environment Variables.

**Production is mandatory.** Preview/Development are optional copies of non-secret public values; never copy localhost `DATABASE_URL` or localhost `NEXT_PUBLIC_APP_URL` into Production.

### Required at BUILD time (Production)

These are inlined / parsed while `next build` collects pages (`src/lib/public-env.ts`). Missing or localhost values fail `/_not-found` collection.

- `NEXT_PUBLIC_APP_URL` — exactly `https://shhh-one-zeta.vercel.app` (no trailing slash)
- `NEXT_PUBLIC_APP_NAME` — optional, defaults to `Shhh`
- `NEXT_PUBLIC_SUPABASE_URL` — optional (Realtime)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — optional (Realtime, never `service_role`)

Vercel sets `VERCEL_ENV=production` on production builds. That makes localhost `NEXT_PUBLIC_APP_URL` invalid.

### Required at RUNTIME (Production)

Checked by `assertProductionEnv` in `src/instrumentation.ts` when `VERCEL_ENV=production`:

- `DATABASE_URL`
- `SESSION_SECRET`
- `AUTHORIZED_USER_1_PIN_HASH`
- `AUTHORIZED_USER_2_PIN_HASH`
- `NEXT_PUBLIC_APP_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

### Public `NEXT_PUBLIC_*`

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BUILD_ID` — optional, `/api/health` only
- `NEXT_PUBLIC_ENABLE_SW` — local/e2e only; production already registers the worker via `NODE_ENV=production`. Do not set this as a production substitute.

### Server-only secrets

Never prefix these with `NEXT_PUBLIC_`:

- `DATABASE_URL`
- `SESSION_SECRET`
- `AUTHORIZED_USER_1_PIN_HASH`
- `AUTHORIZED_USER_2_PIN_HASH`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `YOUTUBE_API_KEY`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

### Optional

- `AUTHORIZED_USER_1_DISPLAY_NAME` / `AUTHORIZED_USER_2_DISPLAY_NAME` (default Saad / Tala)
- `AUTH_PIN_MIN_LENGTH`, `AUTH_SESSION_DAYS`
- `MAX_IMAGE_BYTES`, `MAX_VIDEO_BYTES`, `MAX_AUDIO_BYTES`, `MESSAGE_TEXT_MAX_LENGTH`
- `STORAGE_PROVIDER` (production already forces `r2`)
- YouTube / Spotify keys
- Supabase Realtime public pair

### Test-only — must not exist on Production

- `E2E_FORCE_CHAT_FAIL`
- `E2E_PASSWORD`
- `STORAGE_PROVIDER=test`
- `NEXT_PUBLIC_ENABLE_SW=1` as a production switch
- `RUN_VIDEO_256MB`

Never set `E2E_FORCE_CHAT_FAIL=1` or `STORAGE_PROVIDER=test` on Vercel production. Never put `service_role` or LiveKit secrets in `NEXT_PUBLIC_*`.

## 3. Supabase

This app does **not** use Supabase Auth. The browser client sets `persistSession: false` and `autoRefreshToken: false` (`src/lib/realtime/supabase.ts`).

**Site URL and Redirect URLs are not required** for Shhh to function.

If Realtime is enabled, keep using the existing anon key. Revoke PostgREST table grants so the anon key cannot read tables:

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

`DATABASE_URL` is the Postgres string used by Drizzle. If Postgres is on the same Supabase project, use a **hosted** URI (session pooler / direct), not localhost. On Vercel serverless prefer the pooler (port `6543`) with `sslmode=require`.

## 4. Migrations

From a machine that can reach **production** Postgres (never the local Docker/localhost URL):

```bash
DATABASE_URL='<production postgres url>' pnpm db:migrate
```

Do not reset the database. Do not seed. Backup first (see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)).

## 5. R2 / CORS

Keep the bucket **private**.

Browser uploads use signed `PUT` with header `Content-Type` only (`src/lib/storage/r2.ts` + `uploadBlobWithProgress`). Downloads use signed `GET`. Multipart reads `ETag` from the response.

Exact CORS (no `*`):

```json
[
  {
    "AllowedOrigins": [
      "https://shhh-one-zeta.vercel.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Dashboard path: Cloudflare Dashboard → R2 → bucket → Settings → CORS Policy.

Optional CLI (credentials from `.env.local`, production origin always included):

```bash
pnpm r2:cors
```

After a custom domain, add that origin to CORS and set `NEXT_PUBLIC_APP_URL` to it. Then rerun `pnpm r2:smoke`.

## 6. LiveKit

- `LIVEKIT_URL` must be `wss://….livekit.cloud`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` stay server-side
- Tokens are minted by `/api/calls/[id]/token` for live calls only

## 7. Music providers

- YouTube playback is the official IFrame. No audio ripping.
- `YOUTUBE_API_KEY` is optional (search / counterpart matching). Server-only.
- Spotify: optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`. oEmbed fallback if unset.
- Apple Music: no secret. Public iTunes lookup.

## 8. Production build

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
VERCEL_ENV=production NEXT_PUBLIC_APP_URL=https://shhh-one-zeta.vercel.app pnpm build
```

Vercel runs `pnpm build` with `VERCEL_ENV=production`.

## 9. Deploy order

1. Backup the database
2. Set Vercel Production env (including `NEXT_PUBLIC_APP_URL=https://shhh-one-zeta.vercel.app` and a **hosted** `DATABASE_URL`)
3. `pnpm db:migrate` against that hosted URL
4. Redeploy the **existing** Vercel project (do not import GitHub again)
5. Update R2 CORS if the origin is missing
6. Smoke (section 10)

## 10. Production verification

- `https://shhh-one-zeta.vercel.app` loads over HTTPS
- `/api/health` returns `{ ok: true }`
- Login as both people
- Send text, photo, music, voice
- Audio and video call
- Privacy lock / unlock
- PWA install
- Sign out, then the other identity — no leftover draft/theme/player

## 11. Rollback

- **App:** redeploy the previous Vercel deployment.
- **Service worker:** caches are versioned (`shhh-shell-v3`). A bad worker waits for the next cold start (no `skipWaiting` in production). Users can hard-reload.
- **Database:** only roll back a migration if it is actually reversible. Restore from backup if needed.

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
| Build fails collecting `/_not-found` | Production `NEXT_PUBLIC_APP_URL` must be `https://shhh-one-zeta.vercel.app` |
| Photo upload fails | R2 CORS must include `https://shhh-one-zeta.vercel.app`; methods GET/PUT/HEAD; header Content-Type; expose ETag |
| Calls fail | `LIVEKIT_URL` is `wss://`; keys not in `NEXT_PUBLIC_*` |
| Typing missing | Supabase URL + anon key; table grants still revoked |
| Stale UI after deploy | Cold start / hard reload; SW does not skipWaiting mid-session |
| Wrong identity flash | Confirm Sign out ran; local IndexedDB is cleared by `clearClientSession` |
