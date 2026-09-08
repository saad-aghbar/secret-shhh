# Architecture — Shhh

Private two-person messaging app. Exactly **two** authorized accounts. Exactly **one** permanent conversation.

## Product model

- No public registration, directory, friends graph, chat list, or groups.
- Authenticated users land directly in the shared private space (`/chat`).
- App chrome is Chat / Media / Music / More. Search lives under More. There is no extra tab.

## Layering

```text
src/app          → routes / layouts (App Router)
src/components   → shared UI (shell, primitives)
src/features/*   → domain UI + feature hooks (auth, chat, media, …)
src/lib/*        → db, env, validation, storage, realtime, livekit, sync, uploads
```

Rules:

- UI does not own network retry / upload / sync lifecycles.
- Business mutations go through validated server APIs/actions.
- Never trust `senderId`, ownership, MIME, or filenames from the client.

## Data truth

| Concern                                      | Source of truth                                  |
| -------------------------------------------- | ------------------------------------------------ |
| Messages, receipts, media metadata, calls    | PostgreSQL                                       |
| Realtime delivery / typing / presence notify | Ephemeral Supabase Realtime broadcast (optional) |
| Pending sends / drafts / sync cursor         | IndexedDB (Dexie) on the client                  |
| Media binaries                               | Private Cloudflare R2 (Phase 4+)                 |

WebSocket/realtime events are **notifications**, not the only copy of a message. On reconnect, sync from the last authoritative server cursor (`GET /api/messages/sync?after=`).

## Auth & tenancy

- Allowlist slots: `user_1` / `user_2` mapped to display names (Saad / Tala) for presentation only.
- Phase 1 login: private password verified server-side against Argon2id hashes.
- Sessions: HTTP-only cookie + Postgres `sessions` (revocable, ~30-day rolling).
- One `conversations` row; membership via `conversation_members`.
- Supabase Auth is not required; Postgres may still be hosted on Supabase.

## Phase 2 message architecture

```text
Composer → Dexie pendingMessages → POST /api/messages → PostgreSQL
                                      ↓
                              Realtime notify (optional)
                                      ↓
                         syncAfterCursor / GET /api/messages
```

- Idempotency: unique `(senderId, clientGeneratedId)`.
- Receipts: `message_receipts` batched via `POST /api/messages/delivered` and `/read`.
- Typing: ephemeral broadcast only — never persisted, never includes draft text.
- Presence: session `lastSeenAt` heartbeat → Online / Recently active / Offline.
- Language: app chrome English/LTR; message `textContent` is plain Unicode with per-message `dir="auto"`.

### Local DB (Dexie `shhh-chat`, currently v8)

- `cachedMessages` — recent authoritative copies
- `pendingMessages` — text send queue (isolated from media uploads)
- `syncState` — last server message cursor
- `drafts` — composer text for the current user/conversation
- `pendingUploads` (v2) / `pendingVideoUploads` (v3) / `pendingVoiceUploads` (v4) — media queues

### Retry

Bounded exponential backoff with jitter: ~1s → 30s. Failed sends show “Tap to retry”. Connectivity changes flush the queue.

### Mobile / iPhone notes

- Composer uses `visualViewport` keyboard inset + `env(safe-area-inset-bottom)`.
- Installed PWA / Safari soft-keyboard behavior should be verified on a real iPhone (Playwright covers ~390px Chromium only).
- Message `dir="auto"` + Tajawal fallback should be spot-checked in Safari for Arabic shaping.

## Media (Phase 4 Photos)

- Private Cloudflare R2 bucket; DB stores storage keys only (`message_media`, `media_uploads`).
- Client uploads original + WebP preview/thumb via short-lived signed PUT URLs (R2 in production, `/api/test-storage` locally). Vercel cannot proxy 50 MB bodies. Reads use short-lived signed download URLs after session auth.
- Signed GET via `GET /api/media/{id}/url?variant=thumb|preview|original` after authz — never permanent public URLs.
- `UploadManager` is separate from text `pendingMessages`. Without `R2_*`, in-memory test storage is used.
- Real R2 smoke: `pnpm r2:smoke`. Video uses the same private bucket with a CORS policy that allows named origins to `PUT` presigned multipart parts and expose `ETag`. The bucket is not public.

### Processing & formats

- **Original:** uploaded byte-for-byte (JPEG/PNG/WebP/GIF/HEIC when the picker provides them). Not recompressed.
- **Preview / thumb:** client canvas redraw (~1600 / ~384 long edge WebP). EXIF orientation applied via `createImageBitmap({ imageOrientation: "from-image" })`; metadata stripped from derivatives only.
- **HEIC / HEIF:** accepted for original upload when the browser can decode for derivatives. If decode fails (common outside Safari), user sees a warm error asking for JPEG/PNG — original is not silently corrupted.
- **GIF:** original may remain animated; display derivatives from canvas are a single frame. Do not claim animated preview.
- **SVG:** rejected (active content).

### Persistence honesty

- Dexie `pendingUploads` stores metadata only. Original `File` bytes stay in memory for the session.
- Full page refresh / browser kill: failed jobs ask the user to **reselect photos** before retry. Do not claim byte resume across restarts.

### Orphan cleanup

- Expired `media_uploads` rows (`pending` past `expiresAt`) are swept in a bounded pass after successful finalize (`cleanupExpiredUploads`). No delete-all jobs. Scheduled cron can be added later; until then finalize-triggered cleanup is the safety net.

### Deferred (honest)

- Pre-send drag-reorder: not implemented; picker selection order is preserved.
- Viewer pinch-zoom: not implemented in Phase 4; swipe album + swipe-down dismiss + Escape + View/Download original are.

## Calls (Phase 12 + 13)

Three layers, never confused:

1. **Postgres is lifecycle authority.** `calls` plus a `messages` row of type `call` when the call ends.
2. **Broadcast is only a nudge.** `call:incoming | accepted | declined | cancelled | ended | updated` on `conversation:{id}` carry IDs only. Every client handler refetches `GET /api/calls` or `GET /api/calls/:id`.
3. **LiveKit is only media transport.** Room name is `shhh-call-{uuid}`, minted server-side and stored on the row. The client may send a `callId`, never a room name or identity.

### State machine

`idle → initiating → ringing → connecting → connected ⇄ reconnecting → ending → ended`, with terminal outcomes `completed | missed | declined | cancelled | failed`. Ring timeout is **40 seconds**, validated against server `ringingAt`. Duration is computed server-side from `answeredAt` → `endedAt`.

Every mutation is a conditional update on the expected prior status. Duplicate accept, accept-vs-cancel, and double-tap start converge on one row. A partial unique index (`calls_one_live_per_conversation_uid`) enforces one live call per conversation.

### Token security

`POST /api/calls/:id/token` loads the call, verifies the requester is caller or callee, verifies the call is still live, then issues a short-lived (15m) room-scoped token with `canPublish` / `canSubscribe` only. A third identity is rejected even though LiveKit rooms allow many. Secrets stay server-only (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — never `NEXT_PUBLIC_*`).

### Adaptive quality

Audio-first ladder driven by LiveKit network quality: bitrate → resolution → framerate → pause video, **never the audio track**. Copy: “Connection is weak — keeping audio connected.” Recovery restores video automatically. Low Data Mode reuses `user_preferences.lowDataMode` and starts the ladder lower.

### Reconnection, multi-tab, refresh

Reconnecting is a first-class status and never jumps straight to “Call ended.” Give-up is bounded (`CALL_RECONNECT_GIVE_UP_MS`). `CallSessionProvider` lives in the root layout so navigation does not drop the session. Boot and refresh restore via `GET /api/calls`. `BroadcastChannel("shhh.call")` plus Web Locks keep ringtone from ghosting across tabs. A tab never broadcasts `ended` merely because it mounted with no local call — only a live → terminal transition does. While a call is live, `UploadManager` concurrency is clamped to 1, then restored.

### Device ownership

`src/lib/media/device-owner.ts` claims `voice-recorder | camera | call`. Calls steal. Shared `captureErrorStatus` maps `getUserMedia` errors to consumer copy (`denied`, `missing`, `busy`).

### Honest limits

Incoming calls while the app is fully closed are **not** delivered by visible push — Shhh defaults to discreet mode. That is an intentional privacy tradeoff, not a missing feature. iOS Safari may suspend background media. PiP, fullscreen, and `setSinkId` are feature-detected and hidden when missing. Real-iPhone behavior is **REAL DEVICE UAT PENDING** until tested on device.

## Security non-claims

- HTTPS + DB encryption at rest ≠ end-to-end encryption. E2EE is a dedicated later phase.
- Do not claim access to Apple’s private iMessage sticker library.
- Structured logs must not include message bodies, PINs, cookies, or tokens by default.
- Visible notifications default **OFF**. Shhh does not request notification permission, subscribe to Web Push, show lock-screen previews, or set an app badge. Do not claim the OS can hide the app name/icon, guarantee app-switcher snapshot hiding, or offer Face ID unlock through a generic web API.

## Deployment map

| Layer               | Initial target |
| ------------------- | -------------- |
| App / API           | Vercel         |
| Postgres + Realtime | Supabase       |
| Object storage      | Cloudflare R2  |
| WebRTC              | LiveKit Cloud  |

Business logic stays portable: Drizzle + `pg` against PostgreSQL; provider SDKs isolated under `src/lib/*`.

## Phase 5 shared media, memories & albums

The library reuses Phase 4 storage and the Phase 3 focus/calendar machinery. Nothing about
private R2 changed: albums and favorites curate rows that already exist.

### Schema (migration `0006_phase5_albums.sql`)

| Table                | Shape                                                                    | Notes                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `shared_albums`      | id, conversation_id, title, note, cover_media_id, created_by, timestamps | Cover is `ON DELETE SET NULL`, so removing a photo can never leave a dangling cover. Indexed by `(conversation_id, updated_at desc)`. |
| `shared_album_items` | album_id, media_id, position, added_by, added_at                         | Composite primary key makes duplicate membership impossible in the database, not just in code. Indexed by `(album_id, position)`.     |
| `media_favorites`    | media_id, user_id, created_at                                            | Per-person. "Loved by both" is derived from two rows and never stored.                                                                |

Deleting an album removes the album and its memberships only. Messages, `message_media`
rows and R2 objects are untouched — covered by integration and E2E tests.

### APIs

- `GET /api/media/shared` — cursor pagination with sender, date-range, hearts and sort
  filters. Returns `favoritedBy` and `messageAttachmentCount` aggregated in the query, so a
  page of tiles costs one round trip rather than N.
- `GET|POST /api/media/albums`, `GET|PATCH|DELETE /api/media/albums/[albumId]`,
  `POST|DELETE /api/media/albums/[albumId]/items`, `PATCH .../items/order`.
- `PUT|DELETE /api/media/[id]/favorite`.
- `GET /api/media/messages/[messageId]/attachments` (renamed from the Phase 4
  `/api/media/albums/[messageId]` so album routes are unambiguous).

### Authorization

- Identity always comes from the session; conversation and sender IDs are derived, never
  accepted from the client.
- `getAuthorizedMediaRow` re-checks conversation membership even though callers already
  resolved the conversation, and every album mutation asserts membership first. Media from
  another conversation cannot be added to an album, favorited, or read by ID.
- Multi-step mutations (create with items, reorder, remove) run in transactions.
- Limits are enforced server-side: title/note length, batch size, UUID shape, page size.

### Realtime and reconciliation

- Broadcast carries `media:changed`, `album:changed`, `favorite:changed` — IDs and intent
  only, never image bytes. `useConversationBroadcast` subscribes; `useMediaRealtime`
  invalidates the matching React Query keys.
- Broadcast is an enhancement. Polling plus HTTP refetch remains the recovery path, so a
  missed event self-heals on the next reconciliation instead of leaving a stale library.

### Client

- `src/features/media/*` owns the library: query keys, filters, date grouping, tiles/grid,
  albums, add-to-album, and the realtime bridge. The viewer is still the Phase 4
  `PhotoViewer`, extended with favorite / jump / add-to-album.
- Navigation state lives in the URL and is written with native `history.pushState` /
  `replaceState`, which Next syncs into `useSearchParams` without re-running the server
  component — tab switching is instant, Back still behaves.
- Favorites are optimistic across grid, album and viewer caches with rollback on failure.

### Chat fixes found during Phase 5 acceptance

Three defects surfaced only once the conversation held a realistic amount of photography,
and all three were fixed rather than worked around in tests:

- **Signed URLs are viewport-gated.** `ProgressiveImage` waits until the frame is within
  600px of the viewport before asking for a URL. The virtualizer overshoots before it
  measures real bubble heights, so opening a photo-heavy chat used to fire roughly sixty
  signed-URL requests at once; an upload starting at that moment queued behind them. The
  same page now issues about twelve.
- **The thread re-anchors while rows measure.** Rows start at a 72px estimate and a photo
  bubble measures closer to 300, so a single scroll-to-end landed thousands of pixels
  short: the reader opened chat to a jump control instead of the newest message. The
  initial scroll now re-anchors each frame until the total size stops changing, and
  releases immediately on any scroll the app did not perform itself.
- **`media:changed` reconciles the thread.** Cursor sync only looks forward, so a photo
  that finalized after the partner's cursor passed it needed a manual refresh. The chat now
  refetches and merges the newest page when that event arrives.

### Deferred (honest)

- Virtualization: pagination plus lazy images is enough at current history size; a virtual
  grid would trade scroll stability for little gain today.

## Phase 6 video architecture

Bytes go **browser → R2** on presigned `UploadPart` URLs. The Shhh API only ever sees small JSON (init, sign, record, complete). That is why text chat stays responsive during a large upload.

```text
Composer → UploadManager (Dexie pendingVideoUploads)
        → POST /api/media/video/uploads/init
        → browser PUT parts to private R2
        → PUT .../parts/n (etag bookkeeping)
        → POST .../complete  (ListParts is authoritative)
        → messages.type = video + message_media
```

### Multipart

- Part size: 8 MiB base, adaptive `max(8 MiB, ceilToMiB(totalBytes / 10000))`, uniform except the last part (R2 requirement).
- `MAX_VIDEO_BYTES` is env-configured (default 2 GiB). Architectural ceiling is R2's ~4.995 TiB / 10,000 parts.
- Resume fingerprint: `name|size|lastModified|SHA-256(first 1MiB || last 1MiB)`. This is a
  **resume identity**, not a full-file integrity hash. Completeness is proven by R2 `ListParts`
  (part count and byte sum) plus a 64-byte container sniff after assemble. A same-size file
  that differs only in the middle could theoretically resume against the wrong original; that
  is accepted. Full-file SHA-256 of multi-GB clips is not done (it would freeze the UI).
- After complete, server Range-GETs 64 bytes and sniffs the container. Client ETags are never trusted for the manifest.
- Upload id is not authorization. Routes authenticate, then check `uploader_id`.
- CORS: named origins, `PUT`/`GET`/`HEAD`, `ExposeHeaders: ETag`. Unsigned requests still fail. Probe: `pnpm r2:cors-probe`.

### Client

- Dexie v3 `pendingVideoUploads` stores session metadata + poster blob. The `File` is memory-only.
- Part concurrency follows `connectionManager`: 2 / 1 / 0. Per-part backoff with jitter.
- Posters reuse Phase 4 WebP/JPEG derivatives. A failed poster does not fail the send.
  Chromium can extract a poster from a decodable WebM (MediaRecorder VP8). Files that
  cannot decode (including padded size fixtures) keep a warm still placeholder. iPhone
  HEVC posters are unproven.
- Playback TTL for video originals: 6 hours. Signed URL cache already refreshes before expiry.

### Media entry (UX)

Composer **Add** is **Media** (one `image/*,video/*` picker) and **Camera** (tap still / hold
video). Camera stills enter `enqueueAlbum`; camera recordings enter `enqueueVideo` with the
actual MediaRecorder MIME. Pipelines are not merged. Mixed library picks are sequential
(photo albums, then one video per message). Camera-origin videos cannot be reselected after
a refresh — they have no disk file.

### Honesty limits

- Full-file hashing of multi-GB clips is not done (would freeze the UI). Resume fingerprint
  is identity for reselect, not a byte-for-byte guarantee of the whole original.
- iPhone HEVC/4K is only proven if a real device `.MOV` is dropped into `e2e/fixtures/local/`.
  Synthetic WebM/MP4 fixtures are not iPhone acceptance.
- Photos and voice use signed PUT URLs (same as other small objects), not video multipart.

## Phase 7 voice architecture

A voice note is small, so it reuses the **photo** signed-PUT path, not the
video multipart machinery. There is one variant — the original. No derivatives, no
transcode, no server-side audio decode.

```text
Composer mic → MediaRecorder (+ AnalyserNode envelope)
            → preview (nothing uploaded yet)
            → UploadManager (Dexie v4 pendingVoiceUploads, blob included)
            → POST /api/media/voice/uploads/init
            → PUT  signed upload URL (R2 or test storage)
            → POST /api/media/uploads/[id]/complete
            → POST /api/media/voice/messages          (finalize)
            → messages.type = audio + message_media (durationMs, waveform_samples)
```

### Recording

- Container is chosen at runtime: `audio/mp4` first (only Safari records it, but every engine
  and every iPhone plays it), then `audio/webm;codecs=opus`, then `audio/ogg;codecs=opus`.
  Chromium currently produces `audio/mp4`/AAC, so the common case is iPhone-playable.
- Allowlist (client and server): `audio/mp4`, `audio/webm`, `audio/ogg`, `audio/aac`. Nothing
  else can be recorded and nothing else is accepted — there is no audio file picker.
- Limits: `MIN_VOICE_MESSAGE_MS` 700 ms, `MAX_VOICE_MESSAGE_SECONDS` 600 (auto-stop watchdog
  runs on both rAF and a timer so a hidden tab cannot blow past the cap), `MAX_AUDIO_BYTES`
  env-configured.
- Pause/resume is feature-detected on `MediaRecorder.prototype`; the control is hidden when
  the engine lacks it. Paused time is excluded from the duration.
- Every exit path — send, discard, cap, interruption, unmount, navigation — stops the tracks
  and closes the `AudioContext`. The analyser is never connected to the destination.

### Waveform

- The analyser is sampled ~20×/s during recording; at send time the envelope is compressed to
  64 integer buckets (peak per bucket, normalised to the loudest, square-root lifted) and
  stored in `message_media.waveform_samples` (JSONB, migration `0008_phase7_voice.sql`).
- Playback never decodes audio to draw bars: stored buckets are resampled to whatever bar
  count the track width allows. Silence stays flat instead of amplifying room noise.

### Server

- `initVoiceUpload` validates the declared MIME and size, then reuses `initMediaUpload` with
  `kind: "audio"`. `kind` is server-set per route and is not part of any request schema, so the
  photo endpoint cannot be talked into accepting audio.
- It is resume-aware: if the bytes already landed (`uploaded`/`consumed`) it returns
  `upload: null` and the client skips straight to finalize instead of re-sending the recording.
- `finalizeVoiceMessage` is idempotent on `(senderId, clientGeneratedId)`, Range-GETs the first
  16 bytes and sniffs the container before trusting the declaration. Bytes that sniff as a
  picture (including HEIC, which shares `ftyp` with M4A) are deleted and aborted. An
  unrecognized audio container is tolerated so an untested engine is not bricked. Then it
  writes the message, media row, receipt, and broadcasts `message:new` only — voice is
  deliberately absent from the shared media library, so `media:changed` would be a lie.
- Playback URLs for audio originals get the 6-hour video-style TTL. Downloads are named
  `Voice message.<ext>`; storage keys stay opaque.

### Client

- Dexie v4 `pendingVoiceUploads` persists the recording **blob**, so a queued note resumes by
  itself after a refresh or a reboot — unlike video, nothing has to be reselected. The object
  URL is not persisted (it dies with the page) and is recreated from the blob on hydration.
- A lightweight playback coordinator gives one element the floor at a time; the video player
  joins it, so a note and a clip can never talk over each other.
- Playback speed is a server-side preference (`user_preferences.ui_preferences.voicePlaybackRate`),
  so it follows the person across devices.
- Incoming notes use `message:new` → cursor sync, then a newest-page reconcile. Both are
  skipped while Chat is in a Search/History focus window so they cannot throw away the pinned
  message. `getMessagesAfter` never returns the cursor row itself (JS Date truncation can make
  that row look strictly newer than the Date we loaded it as).

### Honesty limits

- No transcription, so search is a **type filter only**; keyword search can never match a
  recording and says so.
- Real iPhone Safari recording is unproven in CI — Chromium's fake device is the only
  microphone in the harness. `audio/mp4` is chosen first precisely for that path, but device
  acceptance is pending.
- Playback with the screen locked / app backgrounded on iOS is not implemented (no Media
  Session metadata, no background audio session).
- Voice notes are excluded from the media library and albums at the query level; adding one to
  an album by a crafted request is rejected, not silently dropped.
- Finalize refuses when the stored object is missing or shorter than a container header
  (the sniff cannot be skipped). An unrecognized non-image container is still tolerated so
  an untested engine is not bricked. Video MP4 `ftyp` can still sniff as `audio/mp4`.

## Phase 3 search architecture

- **FTS config:** PostgreSQL `simple` (language-neutral). English stemming must not mangle Arabic/mixed text.
- **Maintenance:** trigger `messages_search_vector_trigger` sets `search_vector = to_tsvector('simple', text_content)` on insert/update; GIN `messages_search_vector_idx`.
- **Fallback:** `pg_trgm` GIN on `text_content` for short/partial/URL-ish queries when FTS is weak.
- **APIs:** `GET /api/search/messages`, `GET /api/messages/[id]/context`, `GET /api/history/month`, day first/adjacent.
- Search logs never include query text (private conversation content).

## Phase 9 private stickers

A sticker is a **reusable library object**, not a per-message upload. Bytes live on
`stickers.storage_key` (private R2). Chat rows reference them with `messages.sticker_id`
`ON DELETE RESTRICT`, so a sticker that has history can never be hard-deleted.

```text
Library image → (animated? pass-through : 512α canvas WebP/PNG)
             → POST /api/stickers  (FormData, server putObject)
             → stickers + sticker_library
             → tray
             → POST /api/messages { stickerId }   (same outbox as text)
             → bubbleless sticker in chat
```

### Storage and access

- Keys: `stickers/{uuid}/original.{ext}` and optional `preview.webp`. UUID only — no names.
- One POST with bytes. Not the three-step photo upload. The R2 secret stays server-only.
- Signed read: `GET /api/stickers/[id]/url`. Client cache mirrors media (60s early refresh,
  inflight dedupe, near-viewport gating).
- Usable when `archived_at is null` and the creator is still a member of the caller’s
  conversation. Rename / archive are creator-only.
- Archive sets `archived_at`, wipes library + favorites, keeps R2. Historic messages stay
  and **keep showing the art**. New sends of that sticker are rejected. Tray delete is
  creator-only. `cleanupUnreferencedStickers()` hard-deletes only when zero messages
  reference the row.

### Send path

- `sendMessageSchema` is text **or** sticker. `sendStickerMessage()` shares
  `(senderId, clientGeneratedId)` idempotency and `message:new`.
- Dexie v6 `pendingMessages.stickerId`. Same `inFlight` guard, backoff, and flush as text.
  If the sticker has left the library (`archived_at`), the outbox **drops** that send instead of
  retrying it as a connection failure.
- `VISIBLE_MESSAGE_TYPES` includes `sticker`. Hydrate batch-loads refs (no N+1).

### What stickers are not

- Not `message_media`. Not in the Photos/Videos grid.
- Names are not FTS-indexed (`text_content` only). Type/sender/date filters work.
- No private Apple / iMessage sticker API. Shhh cannot read or write a system sticker library.
- Animated GIF / animated WebP are original bytes. The photo pipeline (`alpha: false`) is
  never used for stickers.

## Phase 10 private doodles

A doodle is a **one-shot drawing message**, not a library object. The canonical payload
is a versioned normalized vector document in `doodles.vector_data` (JSONB). There is no
`messages.doodle_id` — the doodle row points at the message.

```text
+ → Doodle → pointer strokes (normalized 0..1)
           → POST /api/messages { doodle }   (same outbox as text)
           → doodles row + type=doodle message
           → shared SVG renderer in chat / viewer / search / reply
```

### Vector format

- `version: 1` only. Unknown versions render a placeholder, never crash.
- Coordinates are `0..1` triples `[x, y, pressure, …]`. They do not mirror in RTL.
- Tools: `pen` | `marker`. Eraser is an editor operation that splits strokes; it is not stored.
- Colors are `#rrggbb` only. No `url()`, `var()`, or arbitrary CSS.
- Limits: 400 strokes, 2_000 points/stroke, 12_000 total points, 256 KB JSON.
- Background is always logical `paper` (`#f3ead8`) so authored colors stay identical in
  light and dark, and for both people.

### Storage

- JSONB in Postgres. Tiny vector documents do **not** go to R2.
- No preview image in Phase 10. The vector is the source of truth; one SVG renderer
  (`DoodleArt`) draws chat, viewer, search, and reply thumbs.
- `GET /api/doodles/[id]` is session-authed and conversation-scoped for search thumbs.

### Send path

- `sendMessageSchema` is text **or** sticker **or** doodle.
- `sendDoodleMessage()` inserts the message and doodle row in one transaction, then
  broadcasts `message:new`. Same `(senderId, clientGeneratedId)` idempotency.
- Dexie v7 adds `doodleDrafts`. Pending sends carry the full `DoodleRef` on
  `pendingMessages` — no second queue. Offline send works without a preview upload.
- Unsent drafts persist locally (7-day max) with “Continue your doodle?”.

### Future collaboration

`DoodleDocument`, `DoodleStroke`, `DoodleRenderer` (`DoodleArt`), `DoodleEditor`, and
`DoodleMessage` are separate. Phase 10 only sends completed messages. No live strokes,
cursors, or shared sessions.

### What doodles are not

- Not in the Photos/Videos Media grid. Search + Chat are enough.
- Not FTS-indexed. Type / sender / date filters only.
- Not collaborative. Not a graphics editor.

## Phase 11 wallpapers & appearance

Wallpaper schema from migration `0000` was dead code. Phase 11 wires it and adds
`wallpaper_assets` (migration `0012`). Do **not** reuse `message_media` — its
`message_id` is `NOT NULL`.

```text
personal_wallpaper {}     → no override → shared → default (--shhh-wallpaper)
personal_wallpaper type:none → active override, beats shared
conversations.wallpaper_* → shared look, wallpaper_version, wallpaper_updated_by
wallpaper_assets          → private R2 display.webp|jpg|png|gif, owner- or shared-referenced
```

### Config

Version-1 `WallpaperConfig` only. Strict zod. `#rrggbb`. No CSS / url injection.
`resolveChatAppearance({ personal, shared, theme })` is the one source of truth.

### Theme (mode + custom Light / Dark)

`next-themes` still owns the `.dark` class and OS listener. The
`user_preferences.theme` enum is now the persisted Light / Dark / System
preference (`PATCH /api/theme`). Custom colors live in `theme_light` and
`theme_dark` JSONB (migration `0013`).

```text
ThemeConfig v1 { preset, colors: Partial<10 authored keys> }
resolveTheme({ stored, mode }) → derive → --shhh-* 
themeCssText(light, dark) → html:root / html:root.dark
```

- Personal only. No shared theme. No partner realtime.
- Strict `#rrggbb`. Unknown version / keys / CSS injection rejected.
- Uncustomized modes emit no CSS block (sacred `globals.css` defaults).
- Contrast utilities in `src/lib/theme/contrast.ts` pick bubble / button /
  accent foregrounds.
- SSR injects both resolved sets in the root layout. Apply updates the
  `#shhh-theme` style tag, then `router.refresh()`.
- Cross-tab: `BroadcastChannel("shhh.theme")`. Logout clears the client cache
  and drafts.
- Wallpaper and theme stay separate layers. Default (`type: none`) wallpaper
  may tint from the resolved background + accent via `--shhh-wallpaper`.
  Authored solids, gradients, and photos use `--shhh-wallpaper-paint` / the
  image layer and are never recolored by a theme.

### Render

`WallpaperLayer` mounts in `AppShell` for `variant === "chat"` only. First paint
uses SSR CSS vars plus `var(--shhh-wallpaper)` as the no-flash fallback.
Overlay floor is `max(user, floorFor(type, theme))`. Personal saves do not
broadcast. Shared saves emit `appearance:changed` with `{ version }` only.

### Photo assets

Keys: `wallpapers/{conversationId}/{assetUuid}/display.webp|jpg|png|gif`.
Client transcodes library photos (including iPhone HEIC/PNG screenshots) first.
Browser PUTs use short-lived signed R2 URLs (required on Vercel). Signed download URLs are authorized by conversation access **and**
(shared referenced **or** owner). Cleanup follows the sticker `NOT EXISTS`
pattern — never a bucket scan.

### What appearance is not

- Not a shared theme. Theme configs are personal JSONB; wallpaper is the
  shared-or-personal Chat background.
- Not a Media library object.
- Not painted on Search / Media / More (wallpaper). Custom themes **do**
  apply on those surfaces via `--shhh-*`.

## Phase 14 PWA, offline shell & privacy

Shhh installs as a standalone PWA. It does **not** become a noisy messenger.

### Manifest and install

`src/app/manifest.ts` — name/short_name `Shhh`, `id` and `start_url` `/`, `display: standalone`, warm cream `theme_color` / `background_color`. No description. Icons in `public/icon-*.png` plus `src/app/apple-icon.png`. Alternate discreet icon/name is a config swap; **installed PWAs cannot change icon or name dynamically**. Install affordance lives on More (`InstallShhh`): `beforeinstallprompt` where it exists, iOS Share → Add to Home Screen copy otherwise, hidden when already standalone.

### Service worker

`public/sw.js` is hand-written. Versioned caches `shhh-shell-v3` and `shhh-assets-v3`. Deny-list first:

- `/api/**` is network-only and never read from or written to Cache Storage.
- Navigations are network-first. The HTML response is **never cached** (it can embed the conversation). On failure, serve precached `/offline`.
- `/_next/static/**`, icons, and the manifest are cache-first **except on localhost**, where all `/_next/**` pass through so Turbopack chunks cannot be pinned.
- Media, `/_next/image`, HMR, `sw.js`, and `/sw-reset.html` pass through.

Production **never calls `skipWaiting()`**, so a new deploy activates on the next cold start and cannot reload a call, upload, or draft. Localhost workers may `skipWaiting()` and `clients.claim()` so a leftover e2e worker cannot trap `pnpm dev`. `activate` deletes only obsolete `shhh-*` caches. There is no `push` handler and no `notificationclick` handler. Registration is `src/components/pwa/service-worker-registrar.tsx` (`scope: "/"`, `updateViaCache: "none"`) in production or when `NEXT_PUBLIC_ENABLE_SW=1`. Best-effort `navigator.storage.persist()` is feature-detected and never prompts.

### Offline model

IndexedDB (`shhh-chat`) remains the only private data store. The service worker does not grow a second conversation cache. `/offline` is a session-free shell: wordmark, offline status, Retry, and a read-only recent-text list from Dexie when a conversation UUID was remembered and the local lock flag is clear. Reconnect still runs entirely through `syncAfterCursor`, the outbox flush, upload resume, and receipt refresh.

### Lock state and lifecycle

`user_preferences` holds `discreet_mode`, `lock_on_leave`, `blur_when_hidden`, `show_app_badge` (defaults ON / ON / ON / OFF). Cookies: `shhh_lock` and `shhh_hidden_at` (httpOnly). Hide paints the privacy cover immediately and POSTs `/api/privacy/leave`. After 15s (`LOCK_GRACE_MS`) or Quick Lock, POST `/api/privacy/lock`. Unlock is `POST /api/privacy/unlock` with the **account password** (`verifyPassword` + the login throttle). Login and logout clear both cookies.

Two layers:

- **Cold load:** the root layout reads the cookies and, if locked, `PrivacyProvider` does not mount `CallSessionHost`/page children. No chat HTML.
- **Live lock:** overlay + `inert` on the app container. LiveKit stays mounted. Unlock after a server-locked load calls `router.refresh()`.

### Notification and badge policy

VISIBLE NOTIFICATIONS DEFAULT = OFF. No `Notification.requestPermission`, no `PushManager.subscribe`, no `showNotification`, no `setAppBadge`. `enforceDiscreetMode()` only clears a badge if one exists. `document.title` stays `Shhh` (never a partner name, preview, song, or unread count). A Vitest source guard fails the suite if those APIs appear under `src/`.

### Calls interaction

An active call is not ended by `visibilitychange`. The cover may hide the UI; the room stays. After unlock, the same call id and room continue. Closed-app incoming calls do not alert. No stealthy OS notification tricks.

### Cache security

Never cache LiveKit tokens, auth mutations, signed URLs, or API JSON. Production PWA requires a secure context (localhost is the exception). HTTPS is a deployment requirement.

## Phase 15 Our Music

A private two-person soundtrack. Not a streaming service, not a Spotify clone, not public social.

### Canonical track model

`music_tracks` is the recording. `music_track_sources` holds Spotify / Apple / YouTube (and alternate YouTube versions). `music_tracks.youtube_video_id` is the selected playback pointer. Loved by Both is derived from two `music_favorites` rows, never stored. Dedupe: provider+external_id, then ISRC, then YouTube id, then normalized title+artist with duration within 2.5s **and matching variant tag**. Live / acoustic / remaster / cover / remix do not fuzzy-merge. Under-merge is the failure mode.

Library entries are personal (`user_id` set) or shared (`user_id` null) with partial unique indexes. Playlists use 0-based `position` and full-id-list PATCH, same as albums. Song of the Moment is one active row per conversation. Chat music cards live in `messages.type = music` plus `music_message_shares` (optional clip range). Deleting the message never deletes the track. The share note is `messages.text_content`.

### Source adapters and SSRF

User-pasted hosts are allowlisted (YouTube, Spotify, Apple). API fetches use a stricter host list, **https only**, manual redirect revalidation, 8s timeout, 1MB cap (`src/lib/music/providers/fetch.ts`). Optional server-only env: `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (never `NEXT_PUBLIC_`). Apple uses keyless iTunes lookup. Spotify client-credentials, no OAuth. YouTube oEmbed still works for a known video id without a key.

### Playback

One lazily loaded YouTube IFrame. Embed URLs are constructed internally from a validated 11-character id. Clip mode seeks to start and stops at end (IFrame `endSeconds` plus a client watchdog). Queue supports next/previous, optional repeat. `sessionStorage` restores the queue and **never autoplays**. BroadcastChannel `shhh.music` is single-tab ownership.

### Audio ownership

`MusicPlayerProvider` sits inside `PrivacyProvider` and wraps `CallSessionHost`. Mini player + expanded player render beside the call pill. `claimPlayback("shhh-music-player")` mutually pauses voice/video. LiveKit live/ringing pauses music and it stays paused after the call. Privacy lock and cover pause music. Offline (`connectionManager`) disables playback with copy, not a fake download. `document.title` stays the Next.js metadata — never a song name. No notifications, no badge.

### Realtime and offline

`music:changed` is ID-only broadcast; HTTP refetch is the truth. Dexie v8 caches tracks/playlists/recommendations and queues only convergent mutations (favorite, library add/remove, memory by client id). Recommend, playlist edit, and reorder are disabled offline. The service worker already passthroughs cross-origin, so YouTube/iframe/provider responses are never cached.

### Chat and Search

Music messages use the existing send pipeline and `(sender_id, client_generated_id)` idempotency. Clips are server-validated (`start >= 0`, `end > start`, `<= 30s`, within duration). Global Search has a Music type; notes are in the existing tsvector. Composer paste-to-card interception is intentionally skipped. iOS cannot invoke PWA `share_target`; `/music/share` exists for Android and paste-link always works.

### CSP posture

Production headers in `next.config.ts` set a minimal CSP (self + YouTube iframe/API, LiveKit, R2, Supabase, provider artwork), `frame-ancestors 'none'`, HSTS, and a camera/mic Permissions-Policy. `/sw.js` keeps a tighter worker CSP. The document is not embeddable.

## Hosting

Production Next.js runs on **Vercel**. Postgres via `DATABASE_URL` (often Supabase). Private Cloudflare R2 for binaries. LiveKit Cloud for calls. Supabase Realtime is broadcast-only — revoke PostgREST table grants for `anon`/`authenticated`. Migrations run explicitly (`pnpm db:migrate`) before deploy, never on boot.

## Phase status

- **Phase 0:** foundation, schema, theme, expandable shell.
- **Phase 1:** Saad/Tala password login, DB sessions, allowlist-by-slot bootstrap, protected routes.
- **Phase 2:** core text chat, Dexie offline queue, cursor pagination, receipts, typing, bidi-aware messages.
- **Phase 3:** PostgreSQL search, Search + History/Calendar, jump-to-message context, tz-correct date navigation.
- **Phase 4:** Photos in chat — private R2, uploads, albums, viewer, progressive loading (verified with real R2).
- **Phase 5:** Shared media library — date grouping, sender modes, shared albums with notes/covers/order, per-person favorites and Loved by both, viewer + jump-to-message integration, realtime convergence (verified with real R2).
- **Phase 6:** Video sending and playback — presigned browser→R2 multipart, posters, type-aware viewer, Media Library / search / albums. Voice is out of scope. **PHASE 6 COMPLETE — REAL IPHONE HEVC/4K DEVICE ACCEPTANCE PENDING.**
- **Phase 7:** Voice messages — in-composer recording with a live waveform, pre-send preview, private R2 original, seekable waveform playback with persisted speed, offline queue that resumes itself, Voice search filter (no transcription). Verified against real R2. **PHASE 7 COMPLETE — REAL IPHONE SAFARI MICROPHONE ACCEPTANCE PENDING.**
- **Phase 8:** Message interactions — swipe-to-reply, long-press / hover `⋯`, Instagram-style emoji tray + action card, edit, delete-for-everyone tombstone, one reaction per person.
- **Phase 9:** Private stickers — tray, canvas creator with alpha, favorites, save-received, bubbleless chat, Search type filter. Assets on `stickers`, not `message_media`. No Apple sticker API. **PHASE 9 COMPLETE — REAL IPHONE SAFARI CREATOR GESTURES PENDING.**
- **Phase 10:** Private doodles — 4:5 vector drawing, JSONB storage, shared SVG renderer, Search type filter. Not collaborative. **PHASE 10 COMPLETE — REAL IPHONE SAFARI FINGER-DRAWING ACCEPTANCE PENDING.**
- **Phase 11:** Wallpapers & Appearance — personal override vs shared, four types (`none`/`solid`/`gradient`/`image`), private R2 photos with non-destructive focal, non-defeatable readability floor. Full custom Light / Dark themes resolve into `--shhh-*`; System chooses between those two. **PHASE 11 COMPLETE — REAL IPHONE SAFARI APPEARANCE ACCEPTANCE PENDING.**
- **Phase 12 + 13:** Audio/video calls over LiveKit Cloud. Same-room audio→video upgrade. Speaker toggle is capability-honest. Closed-app incoming is intentionally silent.
- **Phase 14:** Installable PWA, hand-written service worker (shell only), offline `/offline` route, Discreet Mode, privacy cover, Quick Lock, password unlock. **VISIBLE NOTIFICATIONS DEFAULT = OFF.**
- **Phase 15:** Our Music — canonical tracks, Spotify/Apple/YouTube sources, YouTube in-app playback, recommendations, playlists, Song of the Moment, chat music cards and ≤30s clips. Search moved under More.
- **Phase 16:** Production hardening — signed R2 uploads for Vercel, CSP/headers, env contract, logout isolation, deployment docs. There is no Phase 17.
