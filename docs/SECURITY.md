# Shhh security

## Threat model

Shhh is a two-person private app. There is no public registration. The main risks are:

- Session theft (cookie)
- Cross-user leakage on a shared browser
- Direct object access to R2 or Postgres
- Server-side fetch abuse from pasted music URLs (SSRF)
- LiveKit room join by a third identity
- Accidental secret exposure in the client bundle or logs

This is not a multi-tenant SaaS. A stolen password for either person is full access to the conversation.

## Auth boundaries

- Only two allowlisted slots. No signup.
- Passwords are Argon2id hashes (env seed, then DB).
- Session: HttpOnly cookie, `Secure` in production, `SameSite=lax`, server-side `sessions` row, revocable.
- Identity for every mutation comes from `resolveAuthorizedSession()`, never from a client `user_id` / `sender_id`.
- Login and unlock share a throttle. Sensitive routes (upload init, music resolve/search, call start, call token) have modest extra limits.

## Server authorization

State-changing `/api/*` requests are origin-checked (same-origin / allowlisted `NEXT_PUBLIC_APP_URL` / Vercel host). Cross-site POSTs are rejected in deployed production.

## RLS / Postgres

The app uses Drizzle over `DATABASE_URL`, not Supabase Auth RLS. If Postgres is on Supabase, the browser anon key must **not** be able to query tables. Revoke `anon`/`authenticated` grants (see [DEPLOYMENT.md](DEPLOYMENT.md)). Do not treat custom session cookies as Supabase JWT RLS.

## Secrets

Never commit or `NEXT_PUBLIC_*` these:

- `SESSION_SECRET`
- PIN hashes
- `DATABASE_URL`
- R2 access keys
- LiveKit API secret
- YouTube / Spotify secrets
- Supabase `service_role`

Production startup (`instrumentation.ts`) fails if required names are missing or `NEXT_PUBLIC_APP_URL` is localhost/http. Production must use `https://shhh-one-zeta.vercel.app` until a custom domain is configured. Errors list **names only**.

## R2

- Private bucket
- Signed PUT/GET with expiry
- Object keys are UUID paths, not filenames
- Upload complete checks size and sniffs image/audio magic bytes
- Users cannot request an arbitrary key; the server looks up ownership first
- `/api/test-storage` and `/content` proxies are disabled when R2 / Vercel production is active

## LiveKit

- Token minted server-side only
- Identity = session user id
- Room name from the call row
- Minimal grants (`roomJoin` for that room)
- Ended / foreign calls cannot mint
- TTL ~15 minutes
- Secret never sent to the client except the short-lived JWT

## SSRF / music URLs

User URLs must be `http`/`https` on an allowlisted host (YouTube, Spotify, Apple). Provider fetches are https-only, allowlisted, manual-redirect revalidated, size/time limited. `javascript:`, `data:`, `file:`, localhost, and private IPs are rejected.

DNS rebinding (an allowlisted hostname resolving to a private IP) is a residual limitation of hostname allowlists.

## CSP / framing

`next.config.ts` sets CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, Referrer-Policy, HSTS, and a camera/mic Permissions-Policy. The app cannot be embedded.

## Offline cache

The service worker caches only `/offline` and static icons/hashed assets. It never caches `/api/**`, HTML navigations, signed URLs, or tokens. Logout clears IndexedDB chat/music caches, drafts, theme/appearance drafts, signed-url memory, and the music player.

## Known browser limitations

- iOS app-switcher snapshots cannot be guaranteed blank
- Background tabs may suspend calls
- No Face ID on a generic PWA
- Autoplay and speaker routing are browser-dependent
