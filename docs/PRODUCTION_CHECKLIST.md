# Production checklist

## Before deploy

- [ ] Database backup / export verified
- [ ] Production env loaded on Vercel (names from `.env.example`)
- [ ] `NEXT_PUBLIC_APP_URL` is the public https origin
- [ ] `SESSION_SECRET` is unique and 32+ characters
- [ ] PIN hashes set (`AUTHORIZED_USER_*_PIN_HASH`)
- [ ] `DATABASE_URL` points at production Postgres (not a local URL)
- [ ] R2 bucket is private; CORS origin = `NEXT_PUBLIC_APP_URL`
- [ ] LiveKit `wss://` URL + server keys (not `NEXT_PUBLIC_*`)
- [ ] Optional YouTube / Spotify keys if you want search
- [ ] Supabase Site URL + redirect URLs match production
- [ ] Supabase `anon`/`authenticated` table grants revoked
- [ ] `pnpm db:migrate` applied to production
- [ ] `E2E_FORCE_CHAT_FAIL` unset
- [ ] `STORAGE_PROVIDER` is not `test`
- [ ] `pnpm build` succeeds

## After deploy

- [ ] HTTPS works
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
