# Shhh — Love-Crafted UI Design Skill

This document is the permanent visual language for the application.

Future UI work must follow it unless explicitly overridden by the product owner.

**Authority chain:** Cursor rule → this skill → `--shhh-*` tokens → `src/components/shhh/*` → screens.

**Priority when styling:**

1. This skill
2. Design tokens
3. Existing Shhh primitive
4. Extend existing primitive
5. Create a new Shhh primitive
6. One-off styling only when genuinely unique

---

## Core feeling

Shhh is a tiny private digital world made for two people.

It is **not** a corporate dashboard, SaaS admin panel, banking app, productivity tool, generic shadcn site, Discord, WhatsApp, Telegram, Instagram, or iMessage.

The interface should feel: lovingly made, warm, soft, intimate, peaceful, cozy, tactile, slightly whimsical, handmade, modern, premium, private, safe.

Think: _someone carefully drew this interface for the person they love_ — not _a developer assembled a dashboard from UI components_.

Love communicates through softness, movement, spacing, small details, warmth, responsiveness, playful shapes, and thoughtful microinteractions — **not** excessive hearts, pink, romantic quotes, emojis, or Valentine’s-Day styling.

---

## Shape language

Avoid hard rectangular geometry wherever possible.

Use: bubbles, pills, blobs, capsules, circles, softly imperfect rounded rectangles, organic containers, floating surfaces.

Corners should almost never feel sharp. Different components should have different organic silhouettes.

| Token role | Scale                               |
| ---------- | ----------------------------------- |
| small      | 12–16px (`--shhh-radius-sm`)        |
| medium     | 20–24px (`--shhh-radius-md`)        |
| large      | 28–36px (`--shhh-radius-lg` / `xl`) |
| bubble     | highly rounded / asymmetric         |
| pill       | 9999px (`--shhh-radius-pill`)       |

---

## Hand-drawn character

~90% polished modern UI, ~10% handmade personality.

Sparse imperfections: slightly asymmetric bubble radii, hand-drawn SVG accents, imperfect underlines, curved separators, soft organic blobs, gently imperfect icon containers, tiny doodle accents.

Never sacrifice readability. Never make everything look like children’s drawings.

---

## No hard boxes

Avoid stacked large bordered rectangles (dashboard cards).

Prefer: floating groups, whitespace, overlapping soft layers, organic sections, inset surfaces, bubbles, hierarchy without borders everywhere.

Separate with background tone, spacing, subtle shadow, translucency, blur, soft elevation — borders sparingly.

---

## Color philosophy

Both themes must feel **warm**. Never pure `#FFFFFF` or `#000000` everywhere. Avoid cold neutral gray interfaces.

### Light

Warm morning: ivory, milk, cream, parchment, linen. Text is warm charcoal, not pure black.

### Dark

Late evening / warm bedroom: very dark warm charcoal / brown-black / muted ink. Text is warm ivory. Soft dusty aqua accent; washed, never neon or gamer cyan.

### Accent

Dusty aqua / mint / teal — calm, warm, gentle. Pair occasionally with muted peach / faded rose / warm cream (`--shhh-love*`). Do not turn the app into a rainbow.

---

## Semantic tokens

Canonical CSS variables live in `src/app/globals.css` under `--shhh-*`.

Surfaces: `--shhh-bg`, `--shhh-bg-soft`, `--shhh-surface`, `--shhh-surface-raised`, `--shhh-surface-floating`

Text: `--shhh-text`, `--shhh-text-soft`, `--shhh-text-muted`

Accent: `--shhh-accent`, `--shhh-accent-soft`, `--shhh-accent-strong`

Love: `--shhh-love`, `--shhh-love-soft`

Border / status: `--shhh-border-soft`, `--shhh-success`, `--shhh-warning`, `--shhh-danger`

Chat: `--shhh-incoming`, `--shhh-outgoing`

Also centralized: radius, spacing, shadow, blur, font sizes/weights, motion durations/easings, safe-area, wallpaper, nav height, focus ring, overlay.

Tailwind `@theme` maps readable utilities to these vars. Components must consume tokens — never hard-code random colors.

---

## International message text

Shhh’s application chrome is English and LTR. User-generated conversation content may contain Arabic, English, mixed bidirectional text, emoji, numbers, punctuation, and URLs. Message-content direction must adapt independently using standards-based bidi handling (`dir="auto"`, `unicode-bidi: plaintext`, logical alignment). Sender bubble position never changes based on message language.

Do **not**: translate the app into Arabic, add a locale/language picker, globally switch the shell to RTL, reverse strings before storage, or invent a custom bidi algorithm.

Chrome (nav, settings, timestamps, receipts, date pills, composer placeholder, errors) stays English. Only the message body and the text inside the composer adapt to typed content.

---

## Typography

Shhh uses Nunito + Gaegu for the product. A third face is allowed only as an Arabic-capable fallback for conversation content.

### Primary UI — Nunito (`font-sans`, `--shhh-font-ui`)

The default for the entire app. Inherited from `<body>` — do not add `font-sans` to every element.

Use for: navigation, buttons, settings, forms, labels, profile names, headings, search, media UI, timestamps, menus, notifications, and all normal application UI. English in message bubbles still prefers Nunito via the message stack.

Weights (Tailwind, not extra font files):

| Weight                | Use                                   |
| --------------------- | ------------------------------------- |
| 400 (`font-normal`)   | Body copy, descriptions               |
| 500 (`font-medium`)   | Secondary emphasis, nav labels        |
| 600 (`font-semibold`) | Buttons, section labels, form labels  |
| 700 (`font-bold`)     | Headings, profile names, important UI |

Nunito’s rounded character reinforces the soft, bubbly Shhh shape language.

### Handmade accent — Gaegu (`font-handmade`, `--shhh-font-handmade`)

Use **sparingly** for emotional, handmade moments:

- Shhh wordmark
- Special empty-state phrases
- Tiny love notes / doodle captions
- Decorative labels
- Occasional playful headings (e.g. login “Who’s here?”)

**Never Gaegu for:** long chat messages, forms, passwords, settings, important instructions, dense UI, accessibility-critical text.

Gaegu is personality — not the primary reading font.

### Wordmark

“Shhh” uses `font-handmade` (Gaegu). It should feel like someone softly wrote _Shhh_ — simple, intimate, not a formal publication title. Smaller and subtler in the app shell than on login. Temporary letter avatars are fallbacks only — design for photos.

### Message content — Nunito + Tajawal (`font-message`, `--shhh-font-message`)

Nunito does not include Arabic glyphs. Conversation bodies and the composer textarea use a stack so Latin stays Nunito and Arabic falls back to **Tajawal** (`--shhh-font-arabic`):

```text
--shhh-font-ui        → Nunito (default chrome)
--shhh-font-handmade  → Gaegu (accent)
--shhh-font-arabic     → Tajawal (Arabic glyphs)
--shhh-font-message    → Nunito, Tajawal (bubbles + composer text only)
```

Do not apply Tajawal to the application chrome. Do not introduce additional Arabic fonts.

### Tokens

```text
--shhh-font-ui        → Nunito (default)
--shhh-font-handmade  → Gaegu (accent)
--shhh-font-arabic     → Tajawal (message fallback)
--shhh-font-message    → Nunito then Tajawal
```

Tailwind: `font-sans` = UI, `font-handmade` = accent, `font-message` = conversation text.

---

## Motion

Feel: breathing, floating, settling, soft bounce, gentle slide, unfolding, appearing like a bubble.

Not: snapping, spinning, aggressive scale, flying across screen, gamer UI, nonstop decoration, delayed core actions.

**Permanent principle:** Shhh should rarely snap between visual states. Meaningful UI state changes should use soft, purposeful transitions where motion improves continuity. Elements should feel like they settle, breathe, glide, unfold, or gently transform. Motion must never delay core actions or hurt performance.

**STATIC STATE = calm. STATE CHANGE = soft motion.**

Before allowing an instant visual snap, consider:

- enter animation
- exit animation
- state transition (e.g. Sent → Delivered → Read)
- positional movement / scroll navigation
- expansion / collapse
- active / inactive transitions

Prefer animating `transform` and `opacity`. Be cautious with width, height, top/left, heavy blur, and animated shadows — especially on iPhone Safari.

| Token                           | Range       | Typical use                            |
| ------------------------------- | ----------- | -------------------------------------- |
| fast (`--shhh-motion-fast`)     | 120–180ms   | micro press, status crossfade          |
| normal (`--shhh-motion-normal`) | 220–300ms   | bubble enter, control transform        |
| slow (`--shhh-motion-slow`)     | 350–500ms   | floating pill enter/exit, scroll glide |
| typing (`--shhh-motion-typing`) | ~700–1200ms | ambient typing dots                    |
| ambient                         | 2–6s        | identity breathe / float               |

Easings: `--shhh-ease-soft`, `--shhh-ease-settle`, `--shhh-ease-spring`.

Button press: tiny compression. Card lift: few pixels. Modal: gentle expand/fade.

### Sheets

Shared `ShhhSheet` (not one-off sheet clones): soft enter/exit (`translateY` + opacity + warm blurred backdrop), drag handle, Esc and backdrop dismiss, iOS-safe body scroll lock, swipe-down dismiss (pointer events; threshold ~100px or velocity). Optional sticky footer for Apply actions. Prefer fade / minimal translate when `prefers-reduced-motion`. **Portal sheets (and desktop Filters panels) to `document.body`** so tab animations / transformed ancestors cannot trap them under the bottom nav; keep an opaque elevated surface so page chrome never bleeds through. Desktop filter chrome may use a compact floating panel that reuses the same motion tokens — do not stretch the mobile sheet full-bleed on large screens.

### Calendars

Shhh-owned day grids only in product flows — no native `<input type="date">` pickers. Soft day cells (≥44px), warm range wash for Search filters, single-select for History. Presets as soft pills. Range taps normalize to `[min, max]`.

**History (mobile-first):** selecting a day shows that day’s messages under the calendar; tapping a message opens Chat. Do not auto-jump to Chat on day tap. Quiet days stay `Quiet day.`

### Confirmation (complex filters)

Draft until Apply for multi-control Filters. Dismiss without Apply discards draft. Removable summary chips under search mutate applied URL state immediately.

### Chat navigation

One floating jump-to-latest control:

- **State A** (`↓`): scrolled away from bottom, no unseen partner messages
- **State B** (`N new message(s) ↓`): scrolled away and partner messages arrived

Partner messages never force-scroll the reader. Own send while scrolled up smoothly returns to newest. Clear unseen only when the latest region is actually reached. Always respect `prefers-reduced-motion` (instant functional scroll; no decorative bounce).

Search/History → Chat: load context directly, settle target ~40% from the top, one-shot warm highlight (scale 1 → 1.015 → 1). Context miss stays recoverable on Search (“This message isn't available anymore.”) — never silently open newest as “focus.”

### “This is you”

Subtle ambient: slow breathing glow, soft imperfect outline, tiny sparkle, very slow scale 1 → 1.015 → 1. Never distracting. Always respect `prefers-reduced-motion`.

---

## Component patterns

**Buttons:** pill-like, soft, tactile, elevated; hover lift/warmth; active compression; soft focus ring; readable disabled state.

**Forms:** soft inset surfaces, large touch targets, rounded/pill shape, warm focus glow. Not admin panels.

**Avatars:** circular or organic blob; soft ring; optional accent glow; photo-ready.

**Navigation:** floating soft island (not a hard full-width bar); active soft bubble; ≥44×44 targets; safe-area insets. Mobile-first (iPhone / PWA), then tablet/laptop/desktop with elegant max-width — do not stretch mobile chrome to 1400px.

**Chat (heart of the app):** conversational bubbles in a private space; asymmetric soft corners; grouping (single / first / middle / last); quiet English timestamps/receipts only on the last bubble of an outgoing group (exceptional Queued/Failed may stay per-message); wallpaper-friendly surfaces; floating bubbly composer; gentle entrance without remount flash on optimistic→acked; one smart jump-to-latest control. Bubble side follows the sender. Text direction follows content. Not a messenger clone.

**Wallpaper:** part of the UI. Surfaces over it use translucency, blur (where performant), contrast overlays, soft shadows.

**Empty states:** short and warm (“Quiet here for now.”). Never developer-placeholder or Phase-speak in production UI.

**Icons:** rounded, simple, slightly playful, consistent stroke. Prefer one cohesive family (Lucide) plus custom Shhh SVGs when needed.

**Shadows:** broad, low-opacity, soft. Dark may add tiny warm ambient glow. Nothing floats dramatically except modals.

**Glass:** sparingly — nav, floating controls, modals, media overlays, call UI.

**Spacing:** generous breathing room. Group with spacing more often than borders.

---

## Decorative system

Reusable theme-colored SVGs in `src/components/shhh/decor/`:

`LoveStroke`, `SoftSpark`, `DoodleUnderline`, `OrganicBlob`, `TinyStar`, `BubbleHalo`

Use strategically and sparsely.

---

## Primitives

Build from `src/components/shhh/`:

`ShhhButton`, `ShhhIconButton`, `ShhhSurface`, `ShhhBubble`, `ShhhCard`, `ShhhInput`, `ShhhAvatar`, `ShhhModal`, `ShhhSheet`, `ShhhNav`, `ShhhToggle`, `ShhhBadge`, `ShhhEmptyState`, `ShhhSpinner`, `ShhhTooltip`

shadcn may supply accessibility/behavior. Never ship default-shadcn look. Shhh owns shape, spacing, color, motion, hierarchy, feel.

---

## Customization architecture

Future options (accent, bubble style, wallpaper, light/dark, font scale, nav style, roundness, reduced motion, personal/shared theme) must be achievable by changing tokens/context — not rewriting components.

Do **not** implement all customization screens until asked. Architect for them now.

---

## Accessibility & performance

Cute does not override a11y: contrast, focus, semantic controls, labels, keyboard, touch targets, reduced motion, meaningful errors.

Prefer CSS transforms/opacity and lightweight SVG. Avoid huge continuous blur layers, particle storms, and JS animation for decoration. 60fps on iPhone Safari wins over decoration.

---

## Responsive rule

Explicitly check: small iPhone, normal iPhone, large phone, tablet, desktop. Frontend work is not finished after desktop-only checks.

---

## Frontend completion checklist

- Looks like Shhh?
- Reuses tokens / primitives?
- Soft shapes; no unnecessary rectangular cards?
- Warm dark and light?
- Works on iPhone + safe areas?
- Reduced motion?
- Accessible?
- Customizable via tokens?
- Looks like generic shadcn or a corporate dashboard? → redesign before done.

---

## Screen direction (Phase 0/1 reference)

**Login:** Keep “Shhh” / “Who’s here?”. Wordmark + playful heading in Gaegu; Saad/Tala names in Nunito bold. Soft password inset + pill CTA. Sparse doodles.

**Shell:** Header is not a website navbar. In-app wordmark in Gaegu (small). Page/partner titles in Nunito. Bottom nav is a floating island.

**More:** Soft visual grouping — not a stack of dashboard rectangles. Forms integrated into the page.

**Chat:** Partner name + presence in the header. Soft date pills (`Today` / `Yesterday`). Composer is a floating highly-rounded object above the nav, safe-area and keyboard aware. Empty thread: “Quiet here for now.”

---

## Photo & Media Experience

Phase 4 photos must feel like intimate messages — never a file uploader, storage console, or generic messenger attachment.

### Shape

- Photo bubbles use the same asymmetric group radii language as text bubbles (incoming/outgoing tip).
- Albums share one cohesive outer radius with soft internal seams (≈2–3px), not hard hairline grids.
- Layouts: 1 hero · 2 pair · 3 large+two · 4 2×2 · 5+ soft glass `+N` overlay.
- Incoming and outgoing must feel equally intentional (warm tint from `--shhh-incoming` / `--shhh-outgoing`).

### Attachment

See **Media entry** below. Do not reintroduce a Photos-only tile.

### Pre-send

- Single: large rounded hero preview. Multi: organic tile composition (not 80px file thumbs).
- Caption placeholder: **Say something…** (`dir="auto"`, message font stack).
- Send CTA: **Send** / **Send photos**.

### Upload

- Optimistic bubble stays visible; soft veil + quiet spinner — no R2/checksum/percentage chrome.
- Offline: **Waiting for connection**. Fail: **Couldn't send · Tap to retry**.

### Viewer

- Warm bedroom charcoal overlay (fixed ink `#1a1612` / `#2a241f` — never theme text, never pure `#000`). Soft vignette.
- Soft rounded photo stage; `object-contain` so the whole photo breathes.
- Glass chrome: top sender + counter pill, close circle; bottom frosted dock with cream **Save photo** + **View original**.
- Album: soft page dots + edge chevrons; swipe L/R; swipe-down dismiss with scale + fade.
- Tap stage toggles chrome (no auto-hide stealing Save). Pinch-zoom deferred.
- First-class **Save photo** (Web Share Level 2 → download → View original). Never toast “Saved” unless known.
- **View original** is a peer consumer action, not a debug control.

### Loading / errors

- Warm aspect placeholder → thumb → preview crossfade.
- Soft **Couldn't load this photo** + Retry — never broken-image glyphs or object keys.
- A photo only asks for its signed URL once it is within ~600px of the viewport. A long
  history mounts far more bubbles than anyone can see, and a stampede of URL requests
  starves whatever the person is doing right now — usually sending the next photo.
- Opening a thread lands on the newest message and keeps re-anchoring until the bubbles
  finish measuring. Photo bubbles are several times taller than the row estimate, so
  anchoring once leaves the reader stranded above a jump control they never asked for.

### Search

- Photo hits show a small rounded thumb + caption (or soft “Photo” if empty).
- Jump focus uses soft `shhh-target-highlight` halo — not a hard yellow box.

### Receipts

- One quiet Sent/Delivered/Read on the logical album/message end (Phase 2 rules).

### Light / dark

- Light: cream/linen surrounds; photos stand out without white cards.
- Dark: warm charcoal; viewer controls translucent ivory-on-ink.

---

## Video Experience

Phase 6 videos must feel like a moment you press play on — never like a file transfer, a progress dashboard, or a stock HTML5 player.

### Shape

- One video per message. The bubble reuses photo radii and the same aspect clamp (~3:4 to ~16:10) so 9:16 never becomes a viewport-tall tile.
- Poster occupies the preview/thumb slots, so tiles, albums, search, and progressive loading stay unchanged.
- Centre play affordance on a soft dark glass disc. Duration lives in a tiny ivory pill, not a timestamp chrome bar.

### Attachment

See **Media entry** below. Do not reintroduce a separate Video tile or Record video tile.

### Upload

- Soft veil, ring, and a quiet percentage. Copy: **Preparing video…**, **Waiting for connection**, **Uploading 42%**, **Finishing…**, **Couldn't send · Tap to retry**.
- Never mention parts, ETags, multipart, or R2.
- After a refresh the poster and true percentage remain. The original file does not. Library clips ask **Choose the video again to continue.** A different file says **That's a different video. Choose the same one to continue.** A camera recording cannot be reselected — say **This clip was recorded in Shhh. After a refresh it can't be sent again.** plus Remove.
- Cancel confirms **Stop sending this video?** then aborts.

### Playback

- Warm bedroom viewer. Custom chrome: play/pause, a real `<input type="range">` scrubber, elapsed/total, mute, fullscreen, replay.
- Native controls only after entering fullscreen.
- Buffering is a quiet **Loading…**. An undecodable codec shows **This video can't be played in this browser.** plus Save/Download original — never a broken glyph.
- Videos never auto-download the original. `preload="metadata"`, dropping to `none` in low data. Seeking is native Range on the signed URL.
- Swipe-to-dismiss must not steal the scrubber or player controls. Pause before any album index change.

### Library & search

- **All media / Photos / Videos** with a `type` URL param.
- Video tiles: play glyph + duration. Mixed albums are allowed. Search rows show poster + duration + caption.

### Light / dark

- Same cream / bedroom charcoal as photos. Player chrome is ivory-on-ink, never a light control bar.

---

## Media entry

Composer media entry is two actions. Never reintroduce separate **Photos** / **Video** / **Record video** tiles.

### Sheet

- `+` soft-presses; opens **Add** with exactly:
  - **Media** — _Choose photos or videos_
  - **Camera** — _Tap for photo · Hold for video_
- One library input: `accept="image/*,video/*"` with multiple. The person does not choose photo vs video before opening the library.
- Images go through the Phase 4 photo pipeline. Videos go through the Phase 6 video pipeline. Do not merge those pipelines.
- Mixed picks are sequential: photos first (albums of up to 10), then each video as its own message. Quiet note: **Videos send one at a time — N more after this.** Do not fake mixed multi-select in one message.
- Copy is conversational. Never **Upload photo** / **Upload video**.
- Mobile: two full-width soft bubble rows in `ShhhSheet`. Desktop: compact floating panel near `+`.
- Voice is **not** in this sheet. The mic lives in the composer's trailing slot (see **Voice Messages**). `+` stays two actions.

### Camera

- One Instagram-like capture surface. No Photo/Video mode tabs. No developer recorder chrome.
- **Tap shutter** → still. **Press and hold** past a short threshold → record. **Release** → stop.
- Cancel the hold if the pointer moves before the threshold so scrolling never starts a recording.
- Live preview, close, front/back flip (`environment` first on phones). Front preview may mirror; captured bytes do not.
- Flash/torch only when `getCapabilities().torch` exists — omit it on iPhone rather than shipping a dead control.
- Recording: shutter transforms, a quiet timer, optional progress ring. No giant flashing red.
- Permission: **Shhh needs camera access to take photos and videos.** Denied: **Camera access is off.** Missing: **No camera found.** Never expose `getUserMedia`, `NotAllowedError`, or `MediaStream`.
- If in-browser capture is not available, fall back to native `<input capture="environment" accept="image/*,video/*">`. Prefer the custom camera when it works.
- Stop every MediaStream track on close and before flipping cameras.

### Preview reuse

- Camera stills open the existing photo pre-send UI. Camera clips open the existing video pre-send UI.
- Camera origin adds **Retake**. Library origin does not.
- Choosing or capturing must never start an upload — Send does.
- Do not invent a separate camera-specific preview.

### Motion

- Idle shutter is a soft circular disc. Tap compresses. Hold grows the core and animates a quiet outer ring.
- Always respect `prefers-reduced-motion`.

---

## Voice Messages

Phase 7 voice must feel like leaning over and saying something — never like a recorder app,
a media player, or a file with a filename. Recording, preview, and the sent note are
**states of one interaction**, not three different UIs.

### Entry

- Trailing composer control: empty → **mic**; words → **Send**. One slot, never two competing.
- Tap mic starts recording. No hold-to-talk, no slide-to-cancel, no Voice tile in `+`.
- Hide the mic when the engine cannot record. Never show a control that fails on tap.
- The mic must not conflict with Camera's tap-photo / hold-video gesture. Camera lives in `+`.

### Recorder morphology

- The composer **morphs in place** into a bar with the same footprint: `rounded-[1.75rem]`,
  `px-2 py-2`, the same elevated surface as the idle composer. Never a giant floating card,
  modal, sheet, or full-screen recorder.
- Desktop: stay in the composer column. Do not stretch the recorder across the chat pane.
- Recording (one row): quiet cancel · pulsing love dot · stable-width `m:ss` · live waveform
  (flex middle) · pause (only if the engine supports it) · stop.
- Cancel is visually quiet. Stop is obvious but **not** a gigantic filled disc — a compact
  square on a 44px hit target. Pause is secondary to Stop.
- No standing instructional copy. Do not say **Listening — tap the square when you're done**.
  The layout teaches the interaction. Tiny status only when needed: opening the mic,
  too-short, last-30s countdown, interrupt/cap.
- Pause freezes the clock and calms the waveform. Paused time is not counted. No extra
  “Paused” paragraph — the still dot is enough.
- Stop under 0.7s is silently discarded.
- Escape discards / closes the voice surface and restores the composer.

### Preview

- Stop transforms the **same shell** into preview. Not a new, taller card with dead space.
- Row 1: play · seekable waveform · **total** duration.
- Row 2, tight: quiet discard · compact **Record again** · **Send** as the existing Shhh
  send control (accent ArrowUp). Send is primary. Record again is secondary. Discard is quiet.
- Preview always shows total duration, never remaining time.
- Nothing uploads until Send. Record again throws the take away and reopens the mic.

### Voice bubble anatomy

- Single row: play (36–40px) · waveform scrubber · duration. Text-bubble grouping radii
  (`1.4rem` family with a `0.5rem` tail) — not photo/video `1.55rem` cards.
- Resting state: play + waveform + duration. No filename, size, speed pill, download icon,
  or icon row.
- Idle clock is **total** duration (`0:06`, `0:59`, `1:03`). While playing: remaining.
  On end, return to total — never leave a finished note showing `0:00`.
- Valid notes are ≥700ms and display at least `0:01`. Store `durationMs` with the message;
  do not depend on the receiver decoding metadata later.
- Speed (`1× → 1.5× → 2× → 1×`) appears only while playing or partly played. Tap cycles.
  Changing speed must not reset position. Preference persists. Replay glyph only after
  the note has actually finished, until the next play. Default icon is Play.
- **Save audio** is a labeled secondary on incoming notes (and failed playback), never a
  permanent Download glyph on every bubble. Copy: **Save audio**.
- Track width is stepped (short compact, long capped) — not linear with duration.
- Upload stays in the same bubble: **Sending 42%** / **Finishing…** / **Waiting for connection**.
  Failure lives on the Phase 2 receipt line: **Couldn't send · Tap to retry**. No spinner
  card, no remount/pop.
- Grouping follows Phase 2 (first / middle / last / standalone). Receipts remain Sent /
  Delivered / Read. Do not add Listened.
- Hidden `<audio>` without `controls`. Shhh owns the player.

### Waveform family

Live, preview, and sent bars are the same language: 3px rounded rails, 2px gaps, love tint
only while recording, accent teal for playback. Played = solid; unplayed ≈ 55% accent, still
readable in dark. Silence is a quiet minimum rail, never a gap. Stored as 64 normalized
buckets — never random, never regenerated on reload. Scrub hit target is taller than the bars.

### Playback

- One audible thing at a time (voice and video share the coordinator).
- Complete → Play (or replay until next play); progress settles to the start; clock shows total.
- Seek/scrub from the waveform. Keyboard: arrows, Home, End.
- Buffering: quiet spinner on the play control. Failed: consumer copy + Save audio.

### Permission

Consumer copy only: **Microphone access is off.** / **No microphone found.** /
**Something else is using the microphone.** / **This browser can't record voice messages yet.**
Never `getUserMedia`, `MediaRecorder`, MIME, codec, R2, Blob, or stack traces.
Blocked is a compact composer-slot card: **Not now** / **Try again**.

### Accessibility

Names: Record a voice message, Stop recording, Pause/Resume recording, Play/Pause/Replay
voice message, Change playback speed, Discard recording, Record again, Send voice message,
Save audio, Cancel recording. Waveform bars are `aria-hidden`. The scrubber is a slider
that announces time. Timer does not announce every frame. Reduced motion: no pulse, no
settle animation. ≥44px hit targets on composer controls.

### Search / History

Voice filter lists notes as **Voice message** + duration. Words never match a recording:
**Voice messages aren't searched by words.** History day rows use the same **Voice message**
label. Jump uses the existing Shhh target highlight.

### iPhone / desktop / dark

- Primary layout: ~390px. Safe areas. Nothing under the home indicator. No horizontal overflow.
  Do not let viewport resize jump the recorder.
- Real iPhone Safari microphone acceptance is separate from Chromium emulation.
- Dark: warm bedroom charcoal, not inverted white. Played/unplayed bars remain distinct.
  Love tint only while recording.

### Never leak

MediaRecorder, AudioContext, AnalyserNode, waveform samples, R2, MIME, Blob, signed URL,
IndexedDB, codec, upload queue.

---

## Shared Media & Memories

Phase 5 turns `/media` into a shared memory library for two people. It must read as
"the things we have kept", never as an asset manager. The photographs are the interface:
chrome exists only where it earns its place.

### Information hierarchy

- One row of mode bubbles: **All · <partner> · <you> · Albums**. Names come from profile
  data, never hard-coded. Four is the ceiling; new capabilities go into filters, not tabs.
- Secondary filtering lives behind a single **Filters** pill (hearts, order, date range),
  with removable chips summarising what is currently narrowing the view.
- Mode, album and filters live in the URL (`view`, `album`, `hearts`, `sort`, `from`, `to`, `type`)
  so Back and reload behave. Tabs and filters `replaceState`, opening an album `pushState` —
  Back closes the album rather than unwinding every toggle, and neither re-runs the server.
- Kind pills **All media / Photos / Videos** sit beside Filters (`type=image|video`).

### Date grouping

- Headers read **Today**, **Yesterday**, then **September**, then **August 2025** once the
  year differs. Locale-aware; never ISO strings, never a timestamp under every thumbnail.
- Within a group, order follows the active sort. Time context belongs to the viewer
  (`Sep 1, 2026 · 7:22 PM`), not the grid.

### Thumbnails

- Fixed `aspect-square` tiles with `1.15rem` clipping. The container owns the aspect so a
  1800×500 panorama and a 420×1400 crop sit in the same calm rhythm.
- Grids load thumbs/previews through the shared signed-URL cache and `ProgressiveImage`
  (warm placeholder → crossfade). Never originals, never a broken-image glyph.
- Multi-photo messages show a small glass count chip; every attachment is its own tile.
- Hover on desktop: a whisper of lift plus a bottom veil. Press on mobile: a small scale.
  No hover-only functionality.

### Sender modes

- Same persisted source, filtered server-side by sender. Switching animates the panel
  (`shhh-mode-panel`) instead of flashing a reload.
- Empty copy is human: "Nothing from Tala yet", never "0 records".

### Album cards

- The cover photograph is the card. A soft ink wash (bottom ~60%, multi-stop so it never
  bands) carries the title, count and note.
- A coverless album is warm cream/charcoal with ink text — a card that is waiting, not one
  that failed to load. Blush placeholder, never sage-grey.
- The overlay block takes `dir="auto"` from the title, so an Arabic album aligns its count
  and note to the same edge; the count itself stays LTR ("3 items", never "items 3").
- No album IDs, no database timestamps, no hard borders.

### Album detail

- Large cover, title, count, optional note bubble, then the media grid.
- Header controls are ink chips (`rgb(20 16 13 / .42)`) over photography and cream chips
  over a coverless header, so they keep contrast on a bright sky or a dark room.
- Everything else lives in one overflow sheet: Edit name and note · Change cover ·
  Reorder items · Remove items · Delete album. Destructive last, in danger ink.
- Empty album: "This album is waiting for a few memories." plus a single Add photos or videos action.

### Album notes

- One small emotional annotation, not a document editor. Plain text, bounded length,
  `dir="auto"` with `unicode-bidi: plaintext`, message font. Placeholder: "Add a little note…".

### Cover behaviour

- Default cover is the first album item; a member can pick any album item instead.
- Cover changes persist, sync, and animate — the card never flashes an empty frame.

### Favorites and Loved by both

- Hearts are per-person library curation, not message reactions. Optimistic with rollback.
- A heart appears on hover/focus, and stays visible once set. Never a wall of hearts.
- **Loved by both** is derived from two favorite rows — never a third stored state. It shows
  as a quiet horizontal row above the grid in All, and as a filter option. Hidden when empty.

### Media action sheets

- Sheets on mobile, centered modals on desktop, through one `MediaOverlay` — never two
  visual languages for the same decision.
- Overlays trap focus, restore it to the trigger, close on Escape, and share one
  reference-counted scroll lock so overlapping enter/exit can never leave the page frozen.
- A trap must not steal focus from a field the person already started typing in.

### Viewer integration

- Reuse the Phase 4 `PhotoViewer`; there is exactly one viewer in the app.
- The viewer navigates the set it was opened from (all media, a sender, an album, or Loved
  by both), and the counter reflects that set.
- Actions: Save photo · View original, with Jump to message · Add to album · favorite in a
  small action sheet. No permanent row of debug buttons.

### Jump to message

- Every media item knows its message. Jump routes to `/chat?focus=<id>&from=media`, reusing
  the Phase 3 historical focus fetch and soft target highlight; a missed focus returns to
  Media rather than dumping the person in Search.

### Loading, empty, error

- Grid: skeleton tiles with the final geometry. Albums: cover skeletons at `4/3`.
- Pagination is a quiet "Show earlier", never a spinner in blank space.
- Empty states are specific: "Nothing shared yet" · "Nothing from Tala yet" ·
  "No albums yet" · "Nothing here" (filtered) · "No favorites yet".
- Errors are recoverable and human: "Couldn't load media." + Retry. Never a status code,
  route name, storage term, or UUID.

### Motion

- Reuse `--shhh-motion-*` and `--shhh-ease-settle`; no ad-hoc durations.
- `shhh-media-in` staggers tile/card entrances (capped so a long history cannot cascade),
  `shhh-mode-panel` carries tab changes, `shhh-pop` is the heart.
- Transform and opacity only; never animate layout across a large grid.
- Reduced motion keeps every state, drops the movement.

### Responsive

- Mobile (390px) is the primary target: two-column grid, sheets, safe areas, no horizontal
  overflow, nothing hidden under the floating nav.
- Desktop uses the `wide` shell — a centered, bounded composition with a larger grid and
  centered dialogs, not phone tiles stretched across a monitor.

### RTL

- App chrome stays LTR. Titles, notes and captions use `dir="auto"` + `unicode-bidi: plaintext`.
- Direction never reorders chronology, and counts never flip.

### Accessibility

- Tiles are buttons with meaningful labels ("Open photo from Tala", "Open video from Tala"); the image itself is
  decorative. Hearts expose `aria-pressed` and name their subject.
- Selection shows a checkmark, not only a colour change. Controls clear 44px.
- Reorder is pointer, touch and keyboard capable (space to lift, arrows to move).

### Videos in the library

- Media rows carry `mediaType`. Grids, filters, albums, and the viewer branch on it.
- Album chrome is mixed-media: counts say "items", actions say "Add photos or videos".
  Keep "photos" only on genuinely photo-only surfaces (the Photos filter pill, Save photo).

---

## Message Interactions

Phase 8 is how a bubble is touched: swipe to reply, long-press to act, a quiet reaction,
an honest edit, a tombstone instead of a hole. The gestures should feel tactile and
intimate — never like a CRUD toolbar bolted onto chat.

### Entry

- **Touch:** swipe right to reply (incoming and outgoing; never inverted by Arabic). Long
  press (~420ms) opens actions. `⋯` stays hidden unless the bubble is hovered, focused,
  or the menu is open — then it sits tight against the bubble, toward the center of the
  thread, never the screen edge. The first 8px of movement locks the axis — vertical
  returns the thread to the native scroller; horizontal claims the pointer.
- **Desktop:** native text selection stays intact. Mouse never long-presses or swipes.
  Hover, click-focus, or right-click reveals `⋯` beside the bubble and opens the same
  anchored popover.
- Photo/video tap still opens the viewer; voice tap still plays. Double-tap to react is
  not a thing — it would delay every one of those.
- Controls that already own the pointer (`voice-scrubber`, play, rate, save, video cancel /
  reselect, retry, the reaction pill, the reply strip) sit behind
  `data-message-gesture-ignore` so a seek never becomes a reply.

### Motion

- Swipe uses `touch-action: pan-y`, rubber-bands past 64px, and commits by 96px.
- A committed swipe or long-press swallows the following click so a photo does not open
  after you meant to reply.
- The lifted bubble scales a whisper (`1.015`). Reduced motion keeps every state and
  drops the movement.
- Virtual keys stay on `clientGeneratedId`. Edit, react, and delete must never remount
  the bubble or yank the list.

### Action surface

- Long-press, `⋯`, and tapping the reaction pill open the same anchored `ShhhPopover`
  on every viewport: emoji tray pill on top, Reply / Edit / Save / Delete in a card
  below, over a warm dim. There is no bottom sheet titled **Message**, no separate
  floating tray, and no **React** row in the list — the tray *is* the react control.
- `ShhhPopover` — portal, flip/clamp, start/end/center align, Escape, outside click,
  optional dim, focus trap. This is the shared anchored primitive; do not invent a
  fourth panel.
- Delete confirms through `MediaOverlay` (sheet on mobile, modal on desktop). Copy is
  human: **This will remove it from the conversation.** Photos/videos add **Photos and
  videos stay in Media.**

### Reactions

- One per person per message. Quick tray: `❤️ 😂 🥺 😮 😭 🔥` plus `＋` that focuses a
  tiny native input so iOS/macOS supplies the real emoji keyboard. No custom grid, no
  extra emoji package, no skin-tone picker.
- Same emoji again removes it. A different one replaces it. The server is set/clear,
  never toggle — retries cannot flip state.
- Summary sits as a soft pill overlapping the bubble: `❤️ 2` when both chose the same,
  `🥺 😂` when different, bare emoji when only one. Count only when it adds information.
- The native input is a transient pill (`Pick any emoji`). On `input` it takes the first
  grapheme, validates, commits, and dismisses. Invalid characters clear with a quiet hint.
  No text field ever persists in the conversation.

### Reply

- A reply is a new message with a one-level preview strip: accent rail, sender name,
  grapheme-safe snippet (or Photo / Video / Voice). Never nest `replyTo.replyTo`.
- Composer grows a floating header (`composer-reply`) with the same strip and a close.
  Attach and voice still work — a photo can answer a text.
- Tapping the strip jumps to the original (in-thread highlight, or the historical context
  path if it is not loaded). The existing jump-to-latest control is the way back.
- New replies to a tombstone are refused. An existing reply keeps rendering
  **Message deleted**.

### Edit

- Text and photo/video captions (`messages.text_content`). Voice is not editable. No
  time limit. Empty edit is not a delete.
- Composer header reads **Editing message**. Send becomes **Save**. Attach and voice hide
  for the edit. A quiet **Edited** sits on the meta line.

### Delete

- For-both only. One tombstone: italic **Message deleted** on a softened incoming/outgoing
  wash — never an empty hole, never a hard-delete flash.
- Caption text is cleared. Media stays in the library and in albums; R2 is untouched.
- Search and month counts hide the row. Chat pagination and History day view keep the
  tombstone so jumps and reply anchors survive.

### Search / History

- Search results may show a tiny **Reply** chip. Edited words are searchable; deleted
  words are not.
- History day rows render tombstones as muted *Message deleted*.

### Light / dark / responsive

- Light: cream surfaces, blush selected reaction, warm danger for Delete.
- Dark: bedroom charcoal sheets and trays, never inverted white cards.
- Primary layout is 390px with safe areas and no horizontal overflow. Desktop uses the
  hover `⋯` and the same anchored popover; do not invent a second action surface for
  large screens.

### RTL / a11y

- App chrome stays LTR. Swipe is always right. Bubble side follows the sender, never the
  language. Snippets and bodies use `dir="auto"`.
- Names: Message, Reply, Edit, Save, Delete, Pick any emoji, Jump to
  {name}'s message, Cancel reply, Cancel edit. Hit targets ≥44px (tray buttons may
  shrink to 40px under 640px so the pill fits a 360px viewport). Focus trap on the
  popover. Escape closes.

### Never leak

Do not show message UUIDs, FTS, Dexie, mutation queues, R2, or `deleted_for_everyone`.
Quiet failure copy only: **That didn’t go through. Try again.**

---

## Stickers

Phase 9 stickers are private, handmade, and bubbleless. They are **not** iMessage, WhatsApp
sticker packs, Telegram packs, or a public marketplace. There is no private Apple API, no
iMessage sticker app, no App Store sticker extension, and no claim that Shhh can read or
write anyone’s system sticker library.

### Feeling

A sticker sits on the thread like a small drawing left on the table — no bubble, no card,
no caption chrome. Transparency must stay visible. The tray feels like a shallow drawer of
shared jokes, not a storefront grid.

### Entry

- The composer sticker button appears **only while the text box is empty and not editing**.
  Typing and edit layouts stay identical to today (`+` · field · send/mic).
- Mobile tray: `ShhhSheet` at about 56vh. Desktop: an anchored `z-[70]` panel beside the
  button (same family as the attach popover).
- Header: **Stickers** plus `+`. Segmented pills: **Recent / Favorites / Mine / {partner}**.
  Partner label is the real display name from session. Never hard-code Saad or Tala in UI.
- Tap a tile to send immediately. The tray **stays open** for rapid sending. Recent reorders
  at the front without a reload.

### Tiles and chat

- Airy 4-column grid. No bordered cards. Rest / hover-lift / press-scale / heart marker.
- In chat: no `ShhhBubble`, `object-contain`, `min(42vw, 9.5rem)` on a phone and `11rem` on
  desktop, aspect clamped so tall or wide art stays contained.
- Missing art (the definition is gone) is a quiet **Sticker unavailable** pill — never a
  broken image. Removing a sticker from the **tray** does not blank messages that already
  used it.
- Reactions, reply strip, time, and receipts sit below the art the same way they do for
  photos. Long-press / `⋯` uses the Phase 8 popover. Extra rows: Save sticker / Unsave
  sticker (received), Rename (own creations). Delete the **sticker definition** from the
  tray (trash on your tiles), not from chat. Deleting a **message** never deletes the
  sticker definition.

### Creator

- Large square workspace, floating control dock — not a form.
- Drag to pan, pinch / wheel / slider to scale, 90° rotate plus a fine tilt, Reset.
- Optional name uses `dir="auto"`.
- Dual-contrast checkerboards (cream and charcoal) so transparency is honest before Save.
- GIF / animated WebP pass through as original bytes. The creator only frames them; it
  never flattens animation on a canvas.
- Camera reuse is out. Library image pick only. Save returns to the open tray; the new
  sticker lands at the top of Mine.

### Empty / loading

- Recent: “No stickers here yet.”
- Favorites: “No favorites yet.”
- Mine: “You haven't made any stickers yet.”
- Partner: “{Name} hasn't made any stickers yet.”
- Loading is a quiet spinner. Failure: “Couldn’t load stickers.” + Try again.

### Search and Media

- Search has a **Stickers** type pill. Names are **not** full-text indexed. Jump-to-message
  shows a small preview.
- Stickers do **not** appear in the Photos / Videos Media grid. Discovery is the tray plus
  Search.

### Never

- No Apple iMessage / private sticker API language.
- No AI background removal.
- No R2, storage keys, MIME, or UUIDs in consumer copy.
- No merging stickers into `message_media` or the Media library.

## Doodles

Phase 10 doodles are a **cute drawing left in the conversation**, not a canvas editor and
not a file attachment. Open → draw → Send. Default everything. The first tap after open
is a stroke, not a settings form.

### Feeling

A doodle sits on cream paper like a torn notepad page. It is never inside the green text
bubble. Authored stroke colors never remap with theme. The paper is the same warm cream
in light and dark so a charcoal line and a white highlight both stay visible for both
people.

### Entry

- Doodle lives in **+** with Media and Camera. Label: **Doodle**. Icon: a small pencil
  squiggle. Do not add another permanent composer icon.
- Three actions: Chat → + → Doodle → draw → Send. No “Create new doodle?”
- Opening Doodle dismisses voice, camera, and the sticker tray.

### Editor anatomy

- Near-full-screen portal (`z-[80]`), camera-family chrome, safe-area top and bottom.
- Top: close, undo / redo / clear, primary **Send** (disabled while empty).
- Center: **4:5** paper workspace, capped on desktop (`max-w-[24rem]`). Never stretch a
  phone canvas to 1500px.
- Bottom: compact floating tool dock — Pen, Marker, Eraser, color swatch.
- Empty hint: “Draw something for {partner}”. Fades on the first stroke. No tutorial.
- Discard with ink: “Discard this doodle?” Keep drawing / Discard.
- Clear is undoable. No scary confirm.
- Unsent drafts persist locally. Stale drafts ask “Continue your doodle?”

### Tools

- Pen: smooth solid stroke, round caps, high opacity. Marker: broader, softer, multiply
  + lower opacity. Eraser: splits vector segments, not a bitmap wipe.
- Tap a selected pen/marker for a small thickness (and marker opacity) pill with a live
  stroke preview. No “Width: 13.472 px”.
- Color: current swatch in the dock. Tap for a compact palette (sage, coral, blush, sky,
  lavender, sun, ink, white) plus a wrapped native custom color. Selected swatch rings
  and shows a check — color is never the only selected cue.

### Sent doodle

- Soft paper card, organic `1.45rem` radius, about `min(72vw, 17.5rem)` wide. No filename,
  no download chrome, no green bubble.
- Tap opens a focused viewer (art first, sender/time secondary). Close is obvious.
- Reactions and receipts sit **below** the paper, never on the drawing.
- Reply preview: tiny paper thumb + “Doodle”.
- Edit is not offered. Delete follows Phase 8.

### Search

- Type pill: **Doodles**. No semantic text search of strokes. Jump uses the same soft
  highlight as other types and must not cover the art.

### Motion and access

- Open / palette / tool settle use existing Shhh motion. Undo is instant. Respect
  `prefers-reduced-motion`.
- Labels: Pen, Marker, Eraser, Undo, Redo, Choose color, Change thickness, Clear doodle,
  Send doodle, Close doodle, Doodle drawing area.
- Canvas coordinates never flip in RTL.

### Never

- No Photoshop toolbar, layers, shapes, filters, or photo backgrounds.
- No live collaborative canvas, cursors, or streaming pointer events.
- No injecting user SVG markup. Paths are built from validated numbers.
- No R2 / JSON / UUID language in consumer copy.
- No Media library filter unless a later phase asks.

## Wallpapers & Appearance

Phase 11 makes Chat feel like *theirs* — a bedroom, not a settings form. One live
preview. Soft presets. A photo they already love. Theme lives here too.

### Feeling

The wallpaper sits *behind* Chat. Messages, header, and composer stay themselves.
A busy photo never wins a fight with a timestamp. The editor should feel like
trying on a bedspread, not configuring a theme engine.

### Where it lives

- Entry: **More → Appearance**. First nested route under More.
- ThemeToggle is **only** here. Do not put a second theme control on More, Chat,
  or anywhere else.
- Wallpaper paints **Chat only**. Search, Media, and More stay on `--shhh-bg`.
- App chrome stays English/LTR. Bubble side follows the sender, never the
  wallpaper or the language.

### Who sees it

- **Personal** — “Only you see this.” An override. Empty `{}` means no override
  (fall through to Shared, then Default). `{ type: "none" }` is an *active*
  override that keeps the plain Shhh default even when they share a photo.
- **Shared** — “You both see this.” Apply asks first, naming the real partner.
- Reset Personal: **Use our shared background** (clears the override).
- Reset Shared: confirm, then both return to Default.

### Types

Four product types, same as the existing `wallpaper_mode` enum. Do not invent a
fifth.

| Product | `type` | Notes |
| --- | --- | --- |
| Default | `none` | The `--shhh-wallpaper` token. Instant, no flash. |
| Color | `solid` | Curated swatches plus one native Custom color. `#rrggbb` only. |
| Gradient | `gradient` | Two stops, three directions: Down / Across / Side. |
| Photo | `image` | Library only. One uncropped WebP. Focal + zoom stay editable. |

Preset row: Default, Sage, Clay, Blush, Cream, Sage mist, Sunset, Photo.

### Preview

The wallpaper preview is built from the real chat primitives — header-shaped bar,
`ChatDateSeparator`, incoming and outgoing `ShhhBubble`, metadata, a reaction
pill, the composer pill. Use polished consumer sample copy only — never live
conversation text, fixtures, or test IDs. Sample: “look what I found ♡” /
“okay that's actually cute.”

Desktop Appearance is `variant="wide"`: preview left, controls right, centered
and capped. Never stretch a phone editor across 1500px.

### Photo

- Image only. No video.
- One EXIF-normalized WebP, 2048 long edge, quality 0.86, no alpha.
- Crop is **non-destructive**. Persist `focalX` / `focalY` (0..1) and `zoom`
  (1..3). Re-editable forever.
- Offline: “Waiting for connection.” No fake local wallpaper.

### Adjust

Sliders labelled **Blur**, **Dim**, **Readability**. No numbers. Apply persists.
Cancel / leave dirty asks “Leave without applying?”

### Readability (non-negotiable)

One render layer: `absolute inset-0 pointer-events-none z-0`. Blur the **base
only**, never the messages. Overlay floor is non-defeatable (photos and
gradients get a small wash; solids do not). Centralized tokens only — never
`style={{ backgroundImage }}` on bubbles, header, or composer.

When a wallpaper is active (`data-wallpaper-active="true"`):

- Message metadata gets a soft text halo (none on Default).
- Reply preview and tombstones get an opacity floor.
- Bubbles pick up a hair more contrast so Sage-on-Sage and cream-on-white still
  read.

Respect `prefers-reduced-motion`: wallpaper swaps instantly, no crossfade.

### Never

- No second Light / Dark / System toggle. It lives only on Appearance.
- No wallpaper on Search / Media / More.
- No CSS strings, gradient strings, or URLs accepted from the client.
- No reusing `message_media` for wallpaper photos.
- No R2 keys, MIME types, or UUIDs in consumer copy.
- No numeric slider readouts.
- No baked pixel crop. Focal stays normalized.

## Full Custom Themes

Light and Dark are two independently customizable Shhh themes. System only
chooses between those two. Theme is personal — never shared. Wallpaper stays a
separate layer: theme is the app’s design language, wallpaper is the Chat
background.

### Resolver

- Stored per user: `theme_light`, `theme_dark` (version-1 sparse JSON), and the
  `theme` enum for Light / Dark / System.
- Authored families: accent, background, surface, your messages, their messages,
  navigation, selected item, buttons, composer, sheets.
- Everything else is derived (`src/lib/theme/derive.ts`) into the existing
  `--shhh-*` tokens. Do not create a parallel token system.
- Empty storage or the Shhh preset with no overrides emits **no** CSS override.
  Existing users keep the exact defaults in `globals.css`.
- Both resolved sets are injected as `html:root` / `html:root.dark` so portaled
  sheets follow the theme and first paint does not flash.

### Contrast and invariants

- Bubble, button, and accent foregrounds are chosen with WCAG contrast, not
  guesswork. Impossible pairs get a safe foreground — they are not rejected.
- Authored content is never recolored: photos, video, emoji, sticker artwork,
  doodle strokes.
- Photo / video / camera controls that sit **on** media stay on
  `--shhh-viewer-ink` / `--shhh-viewer-ivory`. Surrounding chrome is themed.

### Editor

- Appearance stays calm: mode toggle plus two compact theme cards.
- Customize Light and Customize Dark are dedicated routes.
- Presets first, then optional color rows with visual mini previews.
- No CSS variable names, hex fields, or token names in the consumer UI.
- Apply / Cancel use draft state. Reset Light or Reset Dark never touches
  wallpaper.

### Future agents

Never hard-code a semantic UI color. Use `--shhh-*` or the Tailwind utilities
mapped in `@theme inline`. If you need a new role, add a `--shhh-*` token and
derive it.

## Calls

Calls are a Shhh room, not a conference dashboard.

### Surfaces

- Full-screen portal to `document.body` at `z-[90]` (above camera `z-[80]`, below media viewer `z-[100]`).
- Safe areas on every edge. Soft avatar + name + status on audio; no empty video rectangles.
- Video: remote fills the screen. One small rounded local preview in a safe corner. Hybrid chrome: `--shhh-viewer-ink` scrims + ivory glass for contrast over unknown video. Theme accent drives Answer, active toggles, and status.
- Incoming ringing never opens the camera. The receiver camera starts only after Answer.
- Minimized pill: `bottom: calc(8.5rem + var(--shhh-safe-bottom))`, `z-50`, above the tab bar and composer. Tap returns to the call. A chevron minimize control is always on the full-screen surface.

### Controls

- One coherent floating tray. End is always one tap and always discoverable, including when video chrome hides.
- Answer / Decline / End are larger than 44px (about 64px). Other controls stay at least 44px.
- Escape minimizes. It never silently ends, declines, or cancels a call.
- Required labels: Start audio call, Start video call, Answer audio call, Answer video call, Decline call, End call, Mute microphone, Unmute microphone, Turn camera off, Turn camera on, Switch camera, Enter full screen, Exit full screen, Enter picture in picture, Return to call.

### Motion and copy

- Soft breathing ring while ringing; it calms on connect. Respect `prefers-reduced-motion`.
- Live region announces status changes (incoming, connected, reconnecting, ended) — never the per-second timer.
- Consumer language only: “Microphone access is off.”, “Connection is weak — keeping audio connected.”, “Continue without video.”
- History is a centered non-bubble event (`Audio call · 38 min`, `Missed video call`, `Call declined`, `No answer`) with Call again / Video call again.

### Never

- No participant grids, “1 participant” counts, or LiveKit sample chrome.
- No hard-coded sage. Theme tokens only.
- No Apple / Instagram ringtone copies — WebAudio tones are original and stop on every terminal transition.

## PWA & Privacy

Shhh should feel like a small installed app, not a browser tab and not a noisy messenger.

### Install affordance

A quiet row on More — never a permanent INSTALL APP banner. Hide it when `display-mode: standalone` or iOS `navigator.standalone`. Android/desktop may use `beforeinstallprompt`. iOS shows Share → Add to Home Screen. Labels: **Install Shhh**.

### Lock screen

Neutral cream or bedroom charcoal. Handmade **Shhh** wordmark, password field (the same `ShhhInput` as login), Unlock, Sign out. No partner name, no message, no media, no debug status. Shake on a wrong password. Consumer copy only: “That password isn’t right.”

### Privacy cover

Full-screen `--shhh-bg` + wordmark. No fade when leaving the front — privacy beats motion. Respect reduced motion for lock/unlock; the cover itself is instant.

### Privacy page

More → Privacy. Soft `ShhhCard` switches, not an enterprise panel:

- Enable Discreet Mode
- Lock when I leave Shhh
- Blur content when hidden
- Show app badge (off, and disabled while Discreet Mode is on)
- Lock Shhh

### Discreet Mode

Default **ON**. Means: no visible notifications, no previews, no app badge, cover quickly when hidden, lock after a short pause if that preference is on. Do not pretend the OS hides every trace of the app.

### Safe backgrounding

Cover paints on `visibilitychange` / `pagehide`. Lock engages after ~15 seconds when “Lock when I leave” is on, or immediately from Lock Shhh. An active call is not torn down. On return: unlock if locked, then the call is still there.

### Notifications and badges

No lock-screen banners. No “Tala sent you a photo.” No incoming-call system notification. No unread count on the icon. Tab title stays **Shhh** / `Chat · Shhh` — never a message preview or `(3) New messages`.

### Themes

Lock, cover, Privacy, install, and the offline shell consume `--shhh-*`. Custom Light / Dark / System from Phase 11 apply. No flash of the unlocked thread. No flash of the other person’s wallpaper.

### Mobile / desktop

Mobile-first, safe areas, 44px targets. Desktop: the same soft column, not a stretched settings dashboard. Quick Lock is a visible control, not a secret shortcut.

### Reduced motion and accessibility

Cover: instant. Lock/unlock: subtle or none when `prefers-reduced-motion`. When locked, only the lock UI is reachable (`inert` / `aria-hidden` on the app). Screen readers must not read the chat behind it. Required names: Enable Discreet Mode, Lock when I leave Shhh, Blur content when hidden, Show app badge, Lock Shhh, Unlock Shhh, Install Shhh.

---

## Music

Our Music is a **soundtrack Saad and Tala send and keep together**, not a library grid and not a Spotify clone. Songs enter from Chat as often as from the Music tab. Horizontal artwork rows, small rounded-square covers, generous section whitespace, viewer-ink/ivory on artwork (the photo-viewer language), `--shhh-*` only. Gaegu is reserved for the Music wordmark and sparse handmade accents (♡ on our song right now). Nunito for UI. Notes and memories use `dir="auto"`. Bubble side follows the sender, never the language of the title.

### Chat is a first-class send path

Chat `+` attach sheet includes Music beside Media / Camera / Doodle — same row primitive, hint “Send a song or a clip.” Stickers and voice stay on the composer. The Chat Music picker is a send-only sheet (not Add Music’s save/recommend stack, not a `/music` navigation). Thumb-reach order: Search → compact home sections (hide empty) → Paste a link → YouTube only when search already supports it. Tap a song → **Send song** / **Share a clip**. Stay on Chat. Pasting a supported Spotify / Apple / YouTube URL may offer an optional “Send as music?” chip (Music card / Send as link) — never force conversion. Already-sent links keep “Add to Music” in the Phase 8 menu.

### Compact chat cards

A music bubble is a native message, not an album panel. 48–56px rounded art, title, artist, 44px play, optional duration or clip range (`0:42–1:12`), optional `dir="auto"` note. One `•••` (or long-press) opens the existing message menu — no permanent Save / Ours / playlist / Recommend / Open row on the card. Consecutive songs use the same clustered radii as photo/voice. Width stays capped. Clips add a thin progress bar while that range plays. Reply preview is a compact 32px strip. Delete removes the **message only**.

### Home hierarchy

Relationship first. Header keeps Ours / Mine / partner filter pills. Do **not** put Songs / Playlists / Albums / Artists in the primary header as equal tabs.

Home body, hide empty, no reserved giant holes:

1. Our song right now (small featured row, handmade accent — not a banner)
2. For You
3. Our Songs
4. Playlists
5. Loved by Both
6. Recently Added
7. Browse Music (lower-priority text entry)
8. Activity

Personal libraries stay on the filter pills, not a mid-feed “Your library” block on Ours. First-run is three actions (Add a song / Recommend / Make a playlist), not ten empty blocks.

### Browse Music

Songs / Playlists / Albums / Artists live behind Browse Music — a segmented control after Back, still reachable, never the emotional center.

### Rows and artwork

A row is a small square cover, title, artist, optional duration. Play is a 44px target on the cover. Playlist covers derive from a contained track — no extra upload. Prefer flat rows + type. Elevated panels only for our song right now and For You. Do not use Media’s photo mosaic or a Spotify square grid.

### Recommendations

Gift copy, viewer-aware: “Tala sent this for you” / “You sent this for Tala.” Status: Not listened yet / Listened / Loved ♡ / Liked / Not for me. Never dump enum names. Play + small react; no admin button stacks. Sent by Me is a quiet filter, not a second product.

### Playlists

Soft ownership copy: Ours / Saad’s playlist / Tala’s playlist. Note is `dir="auto"`. Compact rows: tap / play / `•••` — no per-row Save/Recommend. Play and Shuffle on the detail header. Reorder with up/down. Disable reorder offline with a sentence, not a dead control.

### Track detail

Hero art 220–280px max. Primary cluster around the song: Play, ♡, Send, Recommend. Secondary (My / Our library, playlist, our song right now, sources, clip, playback version) lives in More. Soft sections below: In our music, Memories (`dir="auto"`), Past songs. Not a vertical settings stack.

### Song of the Moment

Visually “Our song right now” — one small featured row and who set it. Changing it is calm, from More. Past songs is a quiet list, not a trophy case.

### Player and mini player

One global YouTube engine. No second host.

**Chat mini player:** thin pill (`min-h-10`), `[art] Title` + play/pause only. Tap the strip → expanded player. Stack: messages → mini → composer → nav. On Chat, `bottom` clears composer + nav (`~9.35rem + safe`); when the keyboard is up, park above the raised composer. `--shhh-mini-player` belongs in the **message list** inset, not the chat-experience padding (that padding is for the fixed nav). Call pill wins; hide the mini during a full live call. Privacy lock/cover hides the player.

**Other routes:** mini floats above the nav (`z-[45]`), slightly roomier, Next allowed. Yields to the call pill at `8.5rem`.

**Expanded player:** theme-dominant wash (`color-mix` over cream/charcoal, not a muddy album flood). Rounded art, Nunito, restrained icons. Primary: prev / play / next. Secondary: favorite, send, recommend, queue. Unavailable embed: “Playback isn’t available for this version.” plus Choose another version / Open original source. Keyboard: arrows seek, Space toggles, Escape closes. `aria-live` only for the current title. Return focus on close. Respect `prefers-reduced-motion`.

### Clip selector

Not a DAW: one start handle, a 30s window, numeric clock fallback, Preview clip / Send clip. Mounted from Chat picker and Music tab without leaving the current surface.

### Empty states, motion, themes

Handmade title + one warm sentence. Motion is settle/press only. Light cream / dark bedroom charcoal. Custom themes must keep contrast on artwork chrome.

### Mobile, desktop, RTL, privacy

Mobile-first, safe areas, 44px targets. Desktop keeps a centered soundtrack column — not a three-pane Apple Music browser. App chrome stays LTR English. Player UI hides under the privacy cover and lock screen; lock pauses audio. No song title in `document.title`. Nav stays Chat / Media / Music / More. Search stays under More.

---

## Errors and empty routes

404 and fatal errors use the same cream/charcoal surfaces and handmade wordmark. Copy is short and human: “This page isn’t here”, “Something went wrong.” Actions: **Try again** and **Go to Chat**. Never show stack traces, SQL, vendor codes, or raw SDK text.
