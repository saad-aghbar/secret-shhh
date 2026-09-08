import { expect, type Page } from "@playwright/test";

import { loginAs, scrollChatToLatest } from "./media";
import { unlockShhh } from "./privacy";

export const YOUTUBE_FIXTURE = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
export const SPOTIFY_FIXTURE = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
export const APPLE_FIXTURE =
  "https://music.apple.com/us/album/never-gonna-give-you-up/1773292758?i=1773293184";

export async function ensureUnlocked(page: Page) {
  if (await page.getByTestId("lock-screen").isVisible().catch(() => false)) {
    await unlockShhh(page);
    await expect(page.getByTestId("lock-screen")).toHaveCount(0);
  }
}

export async function loginForMusic(page: Page, name: "Saad" | "Tala" = "Saad") {
  await loginAs(page, name);
  await ensureUnlocked(page);
}

export async function gotoApp(page: Page, url: string) {
  await page.goto(url);
  await ensureUnlocked(page);
}

export async function reloadApp(page: Page) {
  await page.reload();
  await ensureUnlocked(page);
}

export async function openMusic(page: Page) {
  await gotoApp(page, "/music");
  await expect(page.getByTestId("music-home")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("music-add")).toBeVisible({ timeout: 20_000 });
}

export async function addMusicLink(page: Page, url: string, saveLabel: "Save to Our Music" | "Save to My Music") {
  await openMusic(page);
  await page.getByTestId("music-add").click();
  await expect(page.getByTestId("add-music-sheet")).toBeVisible();
  await page.getByTestId("add-music-url").fill(url);
  await page.getByTestId("add-music-resolve").click();
  await expect(page.getByTestId("add-music-preview")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: saveLabel }).click();
  await expect(page.getByTestId("add-music-preview")).toBeHidden({ timeout: 20_000 });
  if (saveLabel === "Save to Our Music") {
    await expect(page.getByTestId("music-track-row").first()).toBeVisible({ timeout: 20_000 });
  }
}

export async function addYoutubeToOurMusic(page: Page) {
  await openMusic(page);
  const existing = page.getByTestId("music-track-row").filter({ hasText: /Never Gonna Give You Up/i });
  if (await existing.first().isVisible().catch(() => false)) {
    return;
  }
  await addMusicLink(page, YOUTUBE_FIXTURE, "Save to Our Music");
}

export async function openMusicBrowse(
  page: Page,
  view: "songs" | "playlists" | "albums" | "artists" = "songs",
) {
  const pill = page.getByTestId(`music-browse-${view}`);
  if (!(await pill.isVisible().catch(() => false))) {
    const entry = page.getByTestId("music-browse-entry");
    await expect(entry).toBeVisible({ timeout: 15_000 });
    await entry.click();
  }
  await page.getByTestId(`music-browse-${view}`).click();
}

export async function openTrackMore(page: Page) {
  await expect(page.getByTestId("music-track-more")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("music-track-more").click();
}

export async function openFirstTrack(page: Page) {
  const row = page.getByTestId("music-track-row").first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByTestId("music-track-open").click();
  await expect(page.getByTestId("music-track-detail")).toBeVisible({ timeout: 15_000 });
}

export async function playFirstPlayableTrack(page: Page) {
  const playable = page.locator('[data-testid="music-track-row"][data-youtube-playable="true"]');
  const play = (await playable.count())
    ? playable.first().getByTestId("music-track-play")
    : page.getByTestId("music-track-play").first();
  await expect(play).toBeVisible({ timeout: 20_000 });
  await play.click();
  await expect(page.getByTestId("music-mini-player")).toBeVisible({ timeout: 20_000 });
}

export async function favoriteFirstOurSong(page: Page) {
  await page.evaluate(async () => {
    const home = (await fetch("/api/music/home", { credentials: "same-origin" }).then((r) => r.json())) as {
      home: { ourSongs: Array<{ id: string }>; recentlyAdded: Array<{ id: string }> };
    };
    const track = home.home.ourSongs[0] ?? home.home.recentlyAdded[0];
    if (!track) throw new Error("no track to love");
    const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorited: true }),
    });
    if (!response.ok) throw new Error("favorite failed");
  });
}

export async function sendOpenTrackToChat(page: Page) {
  const pending = page.waitForResponse(
    (response) => response.url().includes("/api/messages") && response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Send to Chat" }).first().click();
  const response = await pending;
  expect(response.ok(), `send music failed: ${response.status()}`).toBeTruthy();
}

export async function openChatLatest(page: Page) {
  await gotoApp(page, "/chat");
  await scrollChatToLatest(page);
}
