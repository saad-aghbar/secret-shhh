# Shhh privacy model

Factual description. Shhh does not claim absolute secrecy.

## Two-user scope

Only two authorized people share one conversation. There are no public profiles, directories, groups, or third-user invites. Anyone with either password can read the conversation.

## No notifications

The product does not request notification permission, subscribe to push, show system notifications, or set an app badge. Incoming calls while the app is fully closed do not alert. `document.title` stays **Shhh**.

## Where data lives

| Data | Where |
| --- | --- |
| Messages, media metadata, calls, music library | PostgreSQL |
| Photos, video, voice, stickers, wallpapers | Private Cloudflare R2 |
| Typing / live notify | Optional Supabase Realtime broadcast (no message body) |
| Call audio/video | LiveKit Cloud (ephemeral media) |
| Music playback | YouTube IFrame (YouTube sees the play request) |
| Drafts, offline queue, recent cache | IndexedDB on the device |

## Provider requests

Pasting a Spotify / Apple / YouTube link makes the **server** fetch metadata from those providers (allowlisted hosts). Playing a song loads YouTube in the browser. Those companies can see that request. This is not an anonymous network.

## Local cache

The device keeps drafts, a recent message cache, pending sends, and a music queue (`sessionStorage`). Logout clears user-specific local data. The installed PWA name and icon stay “Shhh” and cannot change per person.

## App-switcher / lock

Discreet Mode, blur-when-hidden, Quick Lock, and the privacy cover hide the UI in-app. iOS and Android may still snapshot the last frame. That snapshot cannot be guaranteed blank. Treat app-switcher privacy as best-effort.

## What Shhh does not claim

- Nobody can ever see this
- Fully hidden
- Untraceable
- Immune to a stolen password, a seized phone, or a provider subpoena
