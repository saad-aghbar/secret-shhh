# Production checklist

Canonical production origin: `https://shhh-one-zeta.vercel.app`

## Before deploy

- [ ] Database backup / export verified
- [ ] Production env loaded on Vercel (names from `.env.example`)
- [ ] `NEXT_PUBLIC_APP_URL` is `https://shhh-one-zeta.vercel.app` (no trailing slash)
- [ ] `SESSION_SECRET` is unique and 32+ characters
- [ ] PIN hashes set (`AUTHORIZED_USER_*_PIN_HASH`, `base64:…` Argon2 form)
- [ ] `DATABASE_URL` points at **hosted** Postgres (not localhost)
- [ ] R2 bucket is private; CORS includes `https://shhh-one-zeta.vercel.app`
- [ ] LiveKit `wss://` URL + server keys (not `NEXT_PUBLIC_*`)
- [ ] Optional YouTube / Spotify keys if you want search
- [ ] Supabase Auth Site URL / redirects **not required** (Realtime only)
- [ ] Supabase `anon`/`authenticated` table grants revoked
- [ ] `pnpm db:migrate` applied to the hosted production database
- [ ] `E2E_FORCE_CHAT_FAIL` unset
- [ ] `E2E_PASSWORD` unset on Vercel
- [ ] `STORAGE_PROVIDER` is not `test`
- [ ] `pnpm build` succeeds with `VERCEL_ENV=production` and the production app URL

## After deploy

- [ ] HTTPS works at `https://shhh-one-zeta.vercel.app`
- [ ] `/api/health` returns ok
- [ ] Login as Saad
- [ ] Login as Tala
- [ ] Send text
- [ ] Send photo / video
- [ ] Send voice
- [ ] Send music / clip
- [ ] Audio call
- [ ] Video call
- [ ] Search under More
- [ ] Privacy lock / unlock
- [ ] PWA install
- [ ] Logout, then the other account — no leftover draft/theme/player
- [ ] `document.title` is Shhh
- [ ] No system notifications / badges
- [ ] iPhone Safari + installed PWA smoke (if a device is available)

## Rollback triggers

Roll back the app (previous Vercel deployment) if:

- [ ] Auth is broken
- [ ] Messages fail to send or history is missing
- [ ] Media access is broken
- [ ] Calls are globally broken
- [ ] A secret or private payload leaked

Restore the database from backup only if a migration caused data loss. Irreversible migrations cannot be “rolled back” by re-running SQL.
