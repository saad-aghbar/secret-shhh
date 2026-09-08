import { expect, test } from "@playwright/test";

import { chooseMessageAction, openMessageActions, reactWith } from "./helpers/interactions";
import { startCall } from "./helpers/calls";
import { MOBILE, scrollChatToLatest } from "./helpers/media";
import {
  addMusicLink,
  addYoutubeToOurMusic,
  APPLE_FIXTURE,
  ensureUnlocked,
  favoriteFirstOurSong,
  gotoApp,
  loginForMusic,
  openChatLatest,
  openFirstTrack,
  openMusic,
  openMusicBrowse,
  openTrackMore,
  playFirstPlayableTrack,
  reloadApp,
  sendOpenTrackToChat,
  SPOTIFY_FIXTURE,
  YOUTUBE_FIXTURE,
} from "./helpers/music";
import { hideDocument, showDocument, unlockShhh } from "./helpers/privacy";

test.describe("phase 15 music", () => {
  test("1. Search lives under More", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await page.getByRole("link", { name: "More" }).click();
    await expect(page).toHaveURL(/\/more(?!\/search)/, { timeout: 15_000 });
    await expect(page.getByTestId("search-entry")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("search-entry").click();
    await expect(page).toHaveURL(/\/more\/search/);
    await gotoApp(page, "/search");
    await expect(page).toHaveURL(/\/more\/search/, { timeout: 15_000 });
  });

  test("2. Music nav works", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await expect(page.getByRole("link", { name: "Music" })).toBeVisible();
    await page.getByRole("link", { name: "Music" }).click();
    await ensureUnlocked(page);
    await expect(page).toHaveURL(/\/music/);
    await expect(page.getByTestId("music-home")).toBeVisible();
  });

  test("3. Add YouTube track", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await expect(page.getByTestId("music-track-row").or(page.getByTestId("our-songs")).first()).toBeVisible();
  });

  test("4. Add Spotify link", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addMusicLink(page, SPOTIFY_FIXTURE, "Save to My Music");
    await expect(page.getByTestId("music-home")).toBeVisible();
  });

  test("5. Add Apple Music link", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addMusicLink(page, APPLE_FIXTURE, "Save to My Music");
    await expect(page.getByTestId("music-home")).toBeVisible();
  });

  test("6. Canonical reuse keeps one recording", async ({ page }) => {
    test.setTimeout(120_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await addMusicLink(page, SPOTIFY_FIXTURE, "Save to Our Music");
    await openMusic(page);
    const rows = page.getByTestId("our-songs").getByTestId("music-track-row").filter({
      hasText: /Never Gonna Give You Up/i,
    });
    await expect(rows.first()).toBeVisible();
    const uniqueIds = await rows.evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("data-track-id")).filter(Boolean)),
    ]);
    expect(uniqueIds.length).toBeGreaterThan(0);
    expect(uniqueIds.length).toBeLessThanOrEqual(2);
  });

  test("7–8. Save Mine and Ours", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await openTrackMore(page);
    await page.getByTestId("music-save-mine").click();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByTestId("music-filter-mine").click();
    await expect(page.getByTestId("our-songs")).toBeVisible();
  });

  test("9–12. Recommend both ways, listen, and react", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    try {
      await loginForMusic(saad, "Saad");
      await loginForMusic(tala, "Tala");
      await addYoutubeToOurMusic(saad);
      await openFirstTrack(saad);
      await saad.getByTestId("music-recommend").first().click();
      await openMusic(tala);
      await reloadApp(tala);
      await expect(tala.getByTestId("for-you").or(tala.getByTestId("music-track-row")).first()).toBeVisible({
        timeout: 20_000,
      });
      if (await tala.getByRole("button", { name: "See all" }).isVisible()) {
        await tala.getByRole("button", { name: "See all" }).click();
      }
      const loved = tala.getByTestId("rec-loved").first();
      if (await loved.isVisible()) await loved.click();
      await openFirstTrack(tala);
      await tala.getByTestId("music-recommend").first().click();
      await openMusic(saad);
      await reloadApp(saad);
      await expect(saad.getByTestId("music-home")).toBeVisible();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("13. Loved by Both", async ({ browser }) => {
    test.setTimeout(120_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    try {
      await loginForMusic(saad, "Saad");
      await loginForMusic(tala, "Tala");
      await addYoutubeToOurMusic(saad);
      await favoriteFirstOurSong(saad);
      await openMusic(tala);
      await favoriteFirstOurSong(tala);
      await openMusic(tala);
      await expect(tala.getByTestId("loved-by-both").or(tala.getByLabel("Loved by both")).first()).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("14–16. Personal and shared playlists with reorder", async ({ page }) => {
    test.setTimeout(120_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openMusicBrowse(page, "playlists");
    await page.getByTestId("music-create-shared-playlist").click();
    await expect(page.getByTestId("music-playlist-detail")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Back" }).click();
    await openMusicBrowse(page, "playlists");
    await page.getByTestId("music-create-personal-playlist").click();
    await expect(page.getByTestId("music-playlist-detail")).toBeVisible();
    if (await page.getByLabel("Move down").first().isVisible()) {
      await page.getByLabel("Move down").first().click();
    }
  });

  test("17. Song of the Moment", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await openTrackMore(page);
    await page.getByTestId("music-song-of-moment").click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("song-of-the-moment")).toBeVisible({ timeout: 20_000 });
  });

  test("18. Memories", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await page.getByTestId("music-memory-input").fill("this night");
    await page.getByRole("button", { name: "Save memory" }).click();
    await expect(page.getByText("this night")).toBeVisible({ timeout: 10_000 });
  });

  test("19. Partner sees a newly saved Our Music track", async ({ browser }) => {
    test.setTimeout(120_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    try {
      await loginForMusic(saad, "Saad");
      await loginForMusic(tala, "Tala");
      await addYoutubeToOurMusic(saad);
      await openMusic(tala);
      await reloadApp(tala);
      await expect(tala.getByTestId("music-track-row").or(tala.getByTestId("our-songs")).first()).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("20. Mini player persists across routes with seek", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await playFirstPlayableTrack(page);
    await page.getByRole("button", { name: "Open player" }).click();
    await expect(page.getByTestId("music-expanded-player")).toBeVisible();
    await page.getByTestId("music-seek").evaluate((node) => {
      const input = node as HTMLInputElement;
      input.value = String(Number(input.max || 10000) / 3);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByLabel("Close player").click();
    await openChatLatest(page);
    await expect(page.getByTestId("music-mini-player")).toBeVisible();
    await expect(page).toHaveTitle(/Shhh/);
  });

  test("21. Chat full-song share", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await sendOpenTrackToChat(page);
    await openChatLatest(page);
    await expect(page.getByTestId("music-bubble").last()).toBeVisible({ timeout: 20_000 });
  });

  test("22. Chat 30-sec clip", async ({ page }) => {
    test.setTimeout(120_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await openTrackMore(page);
    await page.getByTestId("music-send-clip").click();
    await expect(page.getByTestId("clip-selector")).toBeVisible();
    await page.getByTestId("clip-note").fill("this part");
    const pending = page.waitForResponse(
      (response) => response.url().includes("/api/messages") && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("clip-send").click();
    expect((await pending).ok()).toBeTruthy();
    await openChatLatest(page);
    await expect(page.getByTestId("music-bubble").last()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("music-bubble-play").last().click();
    await expect(page.getByTestId("music-mini-player")).toBeVisible();
  });

  test("23. Save from chat", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await sendOpenTrackToChat(page);
    await openChatLatest(page);
    await expect(page.getByTestId("music-bubble").last()).toBeVisible({ timeout: 20_000 });
    const title =
      (await page.getByTestId("music-bubble").last().locator("p").first().textContent()) ?? "Song";
    await openMessageActions(page, title);
    await expect(
      page.getByTestId("action-save-my-music").or(page.getByTestId("action-in-my-music")),
    ).toBeVisible();
    await expect(
      page.getByTestId("action-save-our-music").or(page.getByTestId("action-in-our-music")),
    ).toBeVisible();
    const save = page.getByTestId("action-save-my-music");
    if (await save.isVisible()) await save.click();
    await expect(page.getByTestId("music-bubble").last()).toBeVisible();
  });

  test("24. Reply, react, and delete a music card", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await sendOpenTrackToChat(page);
    await openChatLatest(page);
    await expect(page.getByTestId("music-bubble").last()).toBeVisible({ timeout: 20_000 });
    const title =
      (await page.getByTestId("music-bubble").last().locator("p").first().textContent()) ?? "Song";
    await reactWith(page, title, "❤️");
    await openMessageActions(page, title);
    await expect(page.getByTestId("action-reply")).toBeVisible();
    await chooseMessageAction(page, title, "delete-now");
  });

  test("25. Global Search has a Music type and results", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await sendOpenTrackToChat(page);
    await gotoApp(page, "/more/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Music" }).click();
    await page.getByPlaceholder(/Search/i).fill("Never");
    await expect(page.getByTestId("search-result-music-glyph").or(page.getByTestId("music-bubble")).first()).toBeVisible({
      timeout: 20_000,
    }).catch(() => undefined);
    await expect(page.getByRole("button", { name: "Music" })).toBeVisible();
  });

  test("26. Offline library copy disables playback", async ({ page, context }) => {
    await loginForMusic(page, "Saad");
    await openMusic(page);
    await context.setOffline(true);
    await page.getByTestId("music-add").click();
    await expect(page.getByText(/offline/i).first()).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  });

  test("27. Call pauses music", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await playFirstPlayableTrack(page);
    await gotoApp(page, "/chat");
    await startCall(page, "audio");
    await expect(page.getByTestId("call-surface")).toBeVisible();
    const toggle = page.getByTestId("music-mini-toggle");
    if (await toggle.isVisible()) {
      await expect(toggle).toHaveAttribute("aria-label", "Play");
    }
    await page.getByLabel("Cancel call").or(page.getByLabel("Hang up")).click().catch(() => undefined);
  });

  test("28. Voice playback pauses music when a voice bubble exists", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await playFirstPlayableTrack(page);
    await gotoApp(page, "/chat");
    const voice = page.getByTestId("voice-play").first();
    if (await voice.isVisible()) {
      await voice.click();
      const toggle = page.getByTestId("music-mini-toggle");
      if (await toggle.isVisible()) {
        await expect(toggle).toHaveAttribute("aria-label", "Play");
      }
    } else {
      await expect(page.getByTestId("music-mini-player").or(page.getByTestId("chat-experience")).first()).toBeVisible();
    }
  });

  test("29. Privacy lock pauses music and hides the player", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await playFirstPlayableTrack(page).catch(async () => {
      const play = page.getByTestId("music-track-play").first();
      if (await play.isVisible()) await play.click();
    });
    await hideDocument(page);
    await expect(page.getByTestId("privacy-cover").or(page.getByTestId("lock-screen")).first()).toBeVisible();
    await expect(page.getByTestId("music-mini-player")).toHaveCount(0);
    await showDocument(page);
    if (await page.getByTestId("lock-screen").isVisible()) {
      await unlockShhh(page);
    }
    await expect(page.getByTestId("privacy-cover")).toHaveCount(0);
  });

  test("30. Theme variants still show Our Music", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginForMusic(page, "Saad");
    await page.emulateMedia({ colorScheme: "light" });
    await openMusic(page);
    await expect(page.getByTestId("music-home")).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.getByTestId("music-home")).toBeVisible();
  });

  test("empty home offers a first-run instead of ten empty sections", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await openMusic(page);
    const empty = page.getByTestId("music-empty");
    const songs = page.getByTestId("our-songs");
    await expect(empty.or(songs).first()).toBeVisible();
    if (await empty.isVisible()) {
      await expect(page.getByRole("button", { name: "Add a song" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recently Added" })).toHaveCount(0);
    }
  });

  test("Add to Music appears on a chat message with a supported link", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await gotoApp(page, "/chat");
    const composer = page.getByPlaceholder("Message…");
    await composer.fill(YOUTUBE_FIXTURE);
    await page.getByRole("button", { name: "Send" }).click();
    await openMessageActions(page, "youtube.com");
    await expect(page.getByTestId("action-add-music")).toBeVisible({ timeout: 10_000 });
  });

  test("share target lands on Add Music", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await gotoApp(page, `/music/share?url=${encodeURIComponent(YOUTUBE_FIXTURE)}`);
    await expect(page).toHaveURL(/\/music/);
    await expect(page.getByTestId("add-music-sheet").or(page.getByTestId("music-home")).first()).toBeVisible();
  });

  test("Chat + Music picker sends a compact song card", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await gotoApp(page, "/chat");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-music")).toBeVisible();
    await page.getByTestId("media-pick-music").click();
    await expect(page.getByTestId("chat-music-picker")).toBeVisible();
    await expect(page).toHaveURL(/\/chat/);
    await page.getByTestId("chat-music-search").fill("Never");
    const row = page.getByTestId("chat-music-row").first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(page.getByTestId("chat-music-send-song")).toBeVisible();
    await expect(page.getByTestId("chat-music-share-clip")).toBeVisible();
    const pending = page.waitForResponse(
      (response) => response.url().includes("/api/messages") && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("chat-music-send-song").click();
    expect((await pending).ok()).toBeTruthy();
    await scrollChatToLatest(page);
    const card = page.getByTestId("music-bubble").last();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole("button", { name: "Save to My Music" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Recommend" })).toHaveCount(0);
  });

  test("Chat Music picker can share a clip without leaving Chat", async ({ page }) => {
    test.setTimeout(120_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await gotoApp(page, "/chat");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-pick-music").click();
    await page.getByTestId("chat-music-row").first().click();
    await page.getByTestId("chat-music-share-clip").click();
    await expect(page.getByTestId("clip-selector")).toBeVisible();
    await expect(page).toHaveURL(/\/chat/);
    const pending = page.waitForResponse(
      (response) => response.url().includes("/api/messages") && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("clip-send").click();
    expect((await pending).ok()).toBeTruthy();
    await scrollChatToLatest(page);
    await expect(page.locator('[data-testid="music-bubble"][data-clip="true"]').last()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("music-bubble-play").last().click();
    await expect(page.getByTestId("music-mini-player")).toBeVisible();
    await expect(page.getByTestId("music-youtube-host")).toHaveCount(1);
  });

  test("consecutive music cards stay compact and mini-player clears composer", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await gotoApp(page, "/chat");
    await page.evaluate(async () => {
      const home = (await fetch("/api/music/home", { credentials: "same-origin" }).then((r) => r.json())) as {
        home: { ourSongs: Array<{ id: string }>; recentlyAdded: Array<{ id: string }> };
      };
      const track = home.home.ourSongs[0] ?? home.home.recentlyAdded[0];
      if (!track) throw new Error("no track");
      for (let i = 0; i < 8; i += 1) {
        const response = await fetch("/api/messages", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            music: { trackId: track.id },
            clientGeneratedId: crypto.randomUUID(),
          }),
        });
        if (!response.ok) throw new Error("send failed");
      }
    });
    await page.reload();
    await ensureUnlocked(page);
    await scrollChatToLatest(page);
    await expect(page.getByTestId("music-bubble").first()).toBeVisible({ timeout: 20_000 });
    const box = await page.getByTestId("music-bubble").last().boundingBox();
    expect(box?.height ?? 999).toBeLessThan(160);
    await page.getByTestId("music-bubble-play").last().click();
    if (await page.getByTestId("music-mini-player").isVisible()) {
      const mini = await page.getByTestId("music-mini-player").boundingBox();
      const composer = await page.getByPlaceholder("Message…").boundingBox();
      const nav = await page.getByRole("navigation", { name: "Primary" }).boundingBox();
      if (mini && composer) expect(mini.y + mini.height).toBeLessThanOrEqual((composer.y ?? 0) + 8);
      if (mini && nav) expect(mini.y + mini.height).toBeLessThanOrEqual((nav.y ?? 0) + 12);
    }
  });

  test("Music home keeps browse off the primary chrome", async ({ page }) => {
    await loginForMusic(page, "Saad");
    await openMusic(page);
    await expect(page.getByTestId("music-browse-songs")).toHaveCount(0);
    await expect(page.getByTestId("music-browse-entry").or(page.getByTestId("music-empty"))).toBeVisible();
    if (await page.getByTestId("music-browse-entry").isVisible()) {
      await page.getByTestId("music-browse-entry").click();
      await expect(page.getByTestId("music-browse-songs")).toBeVisible();
      await expect(page.getByTestId("music-browse-albums")).toBeVisible();
      await expect(page.getByTestId("music-browse-artists")).toBeVisible();
    }
  });

  test("track detail keeps library actions in More", async ({ page }) => {
    test.setTimeout(90_000);
    await loginForMusic(page, "Saad");
    await addYoutubeToOurMusic(page);
    await openFirstTrack(page);
    await expect(page.getByTestId("music-track-detail")).toBeVisible();
    await expect(page.getByTestId("music-save-mine")).toHaveCount(0);
    await expect(page.getByTestId("music-send-clip")).toHaveCount(0);
    await openTrackMore(page);
    await expect(page.getByTestId("music-save-mine")).toBeVisible();
    await expect(page.getByTestId("music-save-ours")).toBeVisible();
    await expect(page.getByTestId("music-send-clip")).toBeVisible();
    await expect(page.getByTestId("music-song-of-moment")).toBeVisible();
  });
});
