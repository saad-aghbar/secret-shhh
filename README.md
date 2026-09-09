# Shhh

A private web app for exactly two people. One conversation. Chat, photos, video, voice, stickers, doodles, calls, and music — installed as a discreet PWA.

There is no public signup, no third user, and no visible system notifications.

## Stack

- Next.js (App Router) on **Vercel**
- PostgreSQL via Drizzle (`DATABASE_URL` — often Supabase Postgres)
- Supabase Realtime for optional typing / instant notify (broadcast only)
- Private Cloudflare R2 for media
- LiveKit Cloud for audio / video calls
- YouTube IFrame for in-app music playback (no ripped audio)

## Local setup

```bash
pnpm install
cp .env.example .env.local
```

Fill `.env.local` (names only are listed in `.env.example`):

1. `DATABASE_URL`
2. `SESSION_SECRET` — `openssl rand -base64 48`
3. PIN hashes — `pnpm auth:hash-pin` (use the `base64:…` form)
4. Optional: Supabase Realtime, R2, LiveKit, YouTube/Spotify keys

```bash
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 → choose Saad or Tala → enter the password.

## Scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm start
pnpm db:migrate
pnpm livekit:smoke
pnpm r2:smoke
pnpm music:smoke
pnpm pwa:icons
```

E2E uses `E2E_PASSWORD` (defaults to the local-dev PIN if unset). Never put that password in client code.

## Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md).

Production URL: `https://shhh-one-zeta.vercel.app`. Set `NEXT_PUBLIC_APP_URL` to that origin (no trailing slash). Update R2 CORS to that exact origin. A future custom domain is a configuration change, not an application rewrite.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md)
- [docs/design/SHHH_DESIGN_SKILL.md](docs/design/SHHH_DESIGN_SKILL.md)
