import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { DESKTOP, MOBILE, scrollChatToLatest } from "./helpers/media";
import {
  addYoutubeToOurMusic,
  gotoApp,
  loginForMusic,
  openFirstTrack,
  openMusic,
  openMusicBrowse,
  openTrackMore,
  playFirstPlayableTrack,
  sendOpenTrackToChat,
} from "./helpers/music";
import { putThemeViaApi } from "./helpers/theme";

const outDir = path.join(process.cwd(), "visual-qa", "music");

async function hideDevChrome(page: Page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-next-badge-root],
      [data-nextjs-toast],
      #__next-build-watcher { display: none !important; }
    `,
  });
}

async function shot(page: Page, name: string, fullPage = false) {
  fs.mkdirSync(outDir, { recursive: true });
  await hideDevChrome(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
}

async function setMode(page: Page, mode: "light" | "dark") {
  await page.evaluate(async (value) => {
    await fetch("/api/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: value }),
    });
  }, mode);
  await page.emulateMedia({ colorScheme: mode });
}

async function ensurePlaylist(page: Page) {
  await page.evaluate(async () => {
    const home = (await fetch("/api/music/home", { credentials: "same-origin" }).then((r) => r.json())) as {
      home: {
        playlists: Array<{ id: string }>;
        ourSongs: Array<{ id: string }>;
        recentlyAdded: Array<{ id: string }>;
      };
    };
    const track = home.home.ourSongs[0] ?? home.home.recentlyAdded[0];
    let playlist = home.home.playlists[0];
    if (!playlist) {
      const created = (await fetch("/api/music/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Ours", collaborative: true }),
      }).then((r) => r.json())) as { playlist?: { id: string } };
      if (created.playlist) playlist = created.playlist;
    }
    if (playlist && track) {
      await fetch(`/api/music/playlists/${playlist.id}/tracks`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
    }
  });
  await gotoApp(page, "/music");
  await openMusicBrowse(page, "playlists");
  if (!(await page.getByTestId("music-playlist-card").first().isVisible().catch(() => false))) {
    await page.getByTestId("music-create-shared-playlist").click();
    await expect(page.getByTestId("music-playlist-detail")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back" }).click();
    await openMusicBrowse(page, "playlists");
  }
}

async function openPlaylistDetail(page: Page) {
  await expect(page.getByTestId("music-playlist-card").first()).toBeVisible({ timeout: 15_000 });
  const withArt = page.getByTestId("music-playlist-card").filter({ has: page.locator("img") });
  const card = (await withArt.count()) > 0 ? withArt.first() : page.getByTestId("music-playlist-card").first();
  await card.click();
  await expect(page.getByTestId("music-playlist-detail")).toBeVisible({ timeout: 20_000 });
}

test.describe.configure({ mode: "default" });

test.describe("phase 15 music visual capture", () => {
  test("390 light matrix", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginForMusic(page, "Saad");
    await setMode(page, "light");
    await openMusic(page);
    await shot(
      page,
      (await page.getByTestId("music-empty").isVisible().catch(() => false))
        ? "390-light-home-empty"
        : "390-light-home-empty-or-populated",
    );
    await page.getByTestId("music-add").click();
    await expect(page.getByTestId("add-music-sheet")).toBeVisible();
    await shot(page, "390-light-add-music");
    await page.keyboard.press("Escape");
    await gotoApp(page, "/more");
    await page.getByTestId("search-entry").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("search-entry")).toBeVisible();
    await shot(page, "390-light-more-search-entry");
    await addYoutubeToOurMusic(page);
    await shot(page, "390-light-home-populated");
    if (await page.getByTestId("for-you").isVisible().catch(() => false)) {
      await shot(page, "390-light-for-you");
    }
    await openMusicBrowse(page, "songs");
    await shot(page, "390-light-our-songs");
    await page.getByTestId("music-browse-home").click();
    const row = page.getByTestId("music-track-row").first();
    if (await row.isVisible()) {
      await playFirstPlayableTrack(page);
      await shot(page, "390-light-mini-player");
      await page.getByRole("button", { name: "Open player" }).click();
      await expect(page.getByTestId("music-expanded-player")).toBeVisible();
      await shot(page, "390-light-expanded-player");
      await page.getByLabel("Close player").click();
      await expect(page.getByTestId("music-expanded-player")).toHaveCount(0);
      await openFirstTrack(page);
      await expect(page.getByTestId("music-track-detail").getByRole("heading").first()).toBeVisible();
      await shot(page, "390-light-track-detail");
      await openTrackMore(page);
      await page.getByTestId("music-send-clip").click();
      await expect(page.getByTestId("clip-selector")).toBeVisible();
      await shot(page, "390-light-clip-selector");
      await page.keyboard.press("Escape");
      await openTrackMore(page);
      await page.getByTestId("music-song-of-moment").click();
      await page.keyboard.press("Escape");
      await sendOpenTrackToChat(page);
      await page.getByRole("button", { name: "Back" }).click();
      await shot(page, "390-light-song-of-the-moment");
    }
    if (await page.getByTestId("for-you").isVisible()) {
      await page.getByRole("button", { name: "See all" }).click();
      await expect(page.getByTestId("music-recommendations")).toBeVisible();
      await shot(page, "390-light-recommendation");
      await page.getByRole("button", { name: "Back" }).click();
    }
    await ensurePlaylist(page);
    await shot(page, "390-light-playlists-browse");
    if (await page.getByTestId("music-playlist-card").first().isVisible()) {
      await openPlaylistDetail(page);
      await shot(page, "390-light-playlist-detail");
      await page.getByRole("button", { name: "Back" }).click();
    }
    await gotoApp(page, "/chat");
    await scrollChatToLatest(page);
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-music")).toBeVisible();
    await shot(page, "390-light-attach-sheet-music");
    await page.getByTestId("media-pick-music").click();
    await expect(page.getByTestId("chat-music-picker")).toBeVisible();
    await shot(page, "390-light-chat-music-picker");
    await page.keyboard.press("Escape");
    await scrollChatToLatest(page);
    await shot(page, "390-light-mini-player-in-chat");
    const bubble = page.getByTestId("music-bubble").last();
    if (await bubble.isVisible().catch(() => false)) {
      await bubble.scrollIntoViewIfNeeded();
      await shot(page, "390-light-chat-music-bubble");
    }
    const clip = page.locator('[data-testid="music-bubble"][data-clip="true"]').last();
    if (await clip.isVisible().catch(() => false)) {
      await clip.scrollIntoViewIfNeeded();
      await shot(page, "390-light-chat-music-clip");
    }
    const musicCount = await page.getByTestId("music-bubble").count();
    if (musicCount >= 5) {
      await shot(page, "390-light-chat-music-row");
    }
  });

  test("390 dark matrix", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "dark" });
    await loginForMusic(page, "Saad");
    await setMode(page, "dark");
    await openMusic(page);
    await shot(page, "390-dark-home");
    if (await page.getByTestId("for-you").isVisible().catch(() => false)) {
      await shot(page, "390-dark-for-you");
    }
    if (await page.getByTestId("music-track-play").first().isVisible()) {
      await playFirstPlayableTrack(page);
      await page.getByRole("button", { name: "Open player" }).click();
      await shot(page, "390-dark-expanded-player");
      await page.getByLabel("Close player").click();
    }
    if (await page.getByTestId("music-track-row").first().isVisible()) {
      await openFirstTrack(page);
      await shot(page, "390-dark-track-detail");
    }
    await gotoApp(page, "/more");
    await page.getByTestId("search-entry").scrollIntoViewIfNeeded();
    await shot(page, "390-dark-more-search-entry");
  });

  test("custom light and dark home and player", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginForMusic(page, "Saad");
    await setMode(page, "light");
    await putThemeViaApi(page, "light", {
      version: 1,
      preset: "blush",
      colors: { accent: "#c48b7a", outgoing: "#7eb8ff" },
    });
    await openMusic(page);
    await shot(page, "custom-light-home");
    if (await page.getByTestId("music-track-play").first().isVisible()) {
      await playFirstPlayableTrack(page);
      await page.getByRole("button", { name: "Open player" }).click();
      await shot(page, "custom-light-player");
      await page.getByLabel("Close player").click();
    }
    await gotoApp(page, "/chat");
    await scrollChatToLatest(page);
    const lightBubble = page.getByTestId("music-bubble").last();
    if (await lightBubble.isVisible().catch(() => false)) {
      await lightBubble.scrollIntoViewIfNeeded();
      await shot(page, "custom-light-chat-music-bubble");
    }
    await setMode(page, "dark");
    await putThemeViaApi(page, "dark", {
      version: 1,
      preset: "midnight",
      colors: { accent: "#d4a090", background: "#1a1614" },
    });
    await openMusic(page);
    await shot(page, "custom-dark-home");
    if (await page.getByTestId("music-track-play").first().isVisible()) {
      await playFirstPlayableTrack(page);
      await page.getByRole("button", { name: "Open player" }).click();
      await shot(page, "custom-dark-player");
      await page.getByLabel("Close player").click();
    }
    await gotoApp(page, "/chat");
    await scrollChatToLatest(page);
    const customBubble = page.getByTestId("music-bubble").last();
    if (await customBubble.isVisible().catch(() => false)) {
      await customBubble.scrollIntoViewIfNeeded();
      await shot(page, "custom-dark-chat-music-bubble");
    }
  });

  test("desktop home, playlist, player, chat bubble", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await loginForMusic(page, "Saad");
    await setMode(page, "light");
    await openMusic(page);
    await shot(page, "desktop-home");
    await openMusicBrowse(page, "playlists");
    await shot(page, "desktop-playlists");
    if (await page.getByTestId("music-playlist-card").first().isVisible()) {
      await openPlaylistDetail(page);
      await shot(page, "desktop-playlist-detail");
      await page.getByRole("button", { name: "Back" }).click();
    }
    await openMusicBrowse(page, "songs");
    if (await page.getByTestId("music-track-play").first().isVisible()) {
      await playFirstPlayableTrack(page);
      await page.getByRole("button", { name: "Open player" }).click();
      await shot(page, "desktop-player");
      await page.getByLabel("Close player").click();
    }
    await gotoApp(page, "/chat");
    await scrollChatToLatest(page);
    await shot(page, "desktop-chat-with-mini-or-bubble");
    const bubble = page.getByTestId("music-bubble").last();
    if (await bubble.isVisible().catch(() => false)) {
      await bubble.scrollIntoViewIfNeeded();
      await shot(page, "desktop-chat-music-bubble");
    }
  });
});
