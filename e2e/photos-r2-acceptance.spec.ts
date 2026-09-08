import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

import { loginAs, revealLatestCaption } from "./helpers/media";

/**
 * Real Cloudflare R2 acceptance (STORAGE_PROVIDER=r2).
 * Skips when provider is not r2 so CI without credentials stays green.
 */
const fixtureJpeg = path.join(__dirname, "fixtures", "tiny.jpg");
const fixturePng = path.join(__dirname, "fixtures", "tiny.png");
const fixtureMacScreenshot = path.join(__dirname, "fixtures", "macos-screenshot.png");

async function sendPhoto(page: Page, file: string, caption: string) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(file);
  await expect(page.getByTestId("photo-selection")).toBeVisible();
  // Cancel still works
  await page.getByRole("button", { name: "Cancel photo selection" }).click();
  await expect(page.getByTestId("photo-selection")).toHaveCount(0);

  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(file);
  await page.getByTestId("photo-caption").fill(caption);
  await page.getByTestId("photo-send").click();
  await revealLatestCaption(page, caption, 90_000);
  const bubble = page.locator('[data-testid="photo-bubble"]').filter({ hasText: caption });
  await expect(bubble).toBeVisible({ timeout: 90_000 });
  // Real R2 writes three variants per photo; on a home connection that can run
  // past a minute. Separate that from partner convergence so a slow upload
  // cannot masquerade as a delivery failure.
  await expect(page.locator('[data-own="true"]').filter({ hasText: caption })).toHaveAttribute(
    "data-status",
    /sent|delivered|read/,
    { timeout: 180_000 },
  );
  return bubble;
}

async function openViewerAndOriginal(page: Page, bubble: ReturnType<Page["locator"]>) {
  await bubble.scrollIntoViewIfNeeded();
  await bubble
    .getByRole("button", { name: /Open photo/i })
    .first()
    .click();
  const viewer = page.getByTestId("photo-viewer");
  await expect(viewer).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("photo-save")).toBeVisible();
  await expect(page.getByTestId("photo-view-original")).toBeVisible();
  await page.getByTestId("photo-view-original").click();
  await expect(page.getByTestId("photo-view-original")).toHaveCount(0, { timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
}

async function expectDeliveredOrRead(page: Page, caption: string) {
  const row = page.locator('[data-own="true"]').filter({ hasText: caption });
  await expect(row).toBeVisible({ timeout: 60_000 });
  // Partner must have the message in-thread; nudge sync/receipt poll.
  await page.waitForTimeout(1_200);
  await expect(row).toHaveAttribute("data-status", /delivered|read/, { timeout: 90_000 });
}

test.describe("photos real R2 acceptance", () => {
  test.beforeEach(() => {
    test.skip(process.env.STORAGE_PROVIDER !== "r2", "Requires STORAGE_PROVIDER=r2");
  });

  test("macOS PNG screenshot Saad → Tala with reload viewer and receipts", async ({ browser }) => {
    test.setTimeout(300_000);

    const saad = await browser.newContext();
    const tala = await browser.newContext();
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();
    await saadPage.setViewportSize({ width: 390, height: 844 });
    await talaPage.setViewportSize({ width: 390, height: 844 });

    await loginAs(saadPage, "Saad");
    await loginAs(talaPage, "Tala");

    const caption = `r2-screenshot-${Date.now()} test`;
    const saadBubble = await sendPhoto(saadPage, fixtureMacScreenshot, caption);

    await expect(saadPage.getByText(/Preview files must/i)).toHaveCount(0);
    await expect(saadPage.getByText(/Couldn't send/i)).toHaveCount(0);
    await revealLatestCaption(talaPage, caption, 90_000);

    const talaBubble = talaPage
      .locator('[data-testid="photo-bubble"]')
      .filter({ hasText: caption });
    await expect(talaBubble).toBeVisible({ timeout: 90_000 });
    await expectDeliveredOrRead(saadPage, caption);

    await talaBubble.scrollIntoViewIfNeeded();
    await talaBubble
      .getByRole("button", { name: /Open photo/i })
      .first()
      .click();
    const viewer = talaPage.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible({ timeout: 20_000 });
    const viewerImage = viewer.locator("img").first();
    await expect(viewerImage).toBeVisible();
    const box = await viewerImage.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.height).toBeGreaterThan(200);

    await talaPage.getByTestId("photo-view-original").click();
    await expect(talaPage.getByTestId("photo-view-original")).toHaveCount(0, { timeout: 30_000 });
    await talaPage.keyboard.press("Escape");

    await saadPage.reload();
    await talaPage.reload();
    await revealLatestCaption(saadPage, caption, 60_000);
    await revealLatestCaption(talaPage, caption, 60_000);
    await expect(
      saadPage.locator('[data-testid="photo-bubble"]').filter({ hasText: caption }),
    ).toBeVisible();
    await expect(
      talaPage.locator('[data-testid="photo-bubble"]').filter({ hasText: caption }),
    ).toBeVisible();

    await openViewerAndOriginal(saadPage, saadBubble);

    await saad.close();
    await tala.close();
  });

  test("Saad → Tala and Tala → Saad with reload persistence", async ({ browser }) => {
    test.setTimeout(300_000);

    const saad = await browser.newContext();
    const tala = await browser.newContext();
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();
    await saadPage.setViewportSize({ width: 390, height: 844 });
    await talaPage.setViewportSize({ width: 390, height: 844 });

    await loginAs(saadPage, "Saad");
    await loginAs(talaPage, "Tala");

    const saadCaption = `r2-saad-${Date.now()} هاي`;
    const saadBubble = await sendPhoto(saadPage, fixtureJpeg, saadCaption);
    await revealLatestCaption(talaPage, saadCaption, 90_000);
    const talaSeesSaad = talaPage
      .locator('[data-testid="photo-bubble"]')
      .filter({ hasText: saadCaption });
    await expect(talaSeesSaad).toBeVisible({ timeout: 90_000 });
    await expectDeliveredOrRead(saadPage, saadCaption);
    await openViewerAndOriginal(talaPage, talaSeesSaad);
    await openViewerAndOriginal(saadPage, saadBubble);

    const talaCaption = `r2-tala-${Date.now()} from today`;
    const talaBubble = await sendPhoto(talaPage, fixturePng, talaCaption);
    await revealLatestCaption(saadPage, talaCaption, 90_000);
    const saadSeesTala = saadPage
      .locator('[data-testid="photo-bubble"]')
      .filter({ hasText: talaCaption });
    await expect(saadSeesTala).toBeVisible({ timeout: 90_000 });
    await expectDeliveredOrRead(talaPage, talaCaption);
    await openViewerAndOriginal(saadPage, saadSeesTala);
    await openViewerAndOriginal(talaPage, talaBubble);

    // Multi-photo album: one message, order preserved, viewer next works
    const albumCaption = `r2-album-${Date.now()}`;
    await saadPage.getByTestId("photo-attach").click();
    await saadPage.getByTestId("media-input").setInputFiles([fixtureJpeg, fixturePng, fixtureJpeg]);
    await expect(saadPage.getByTestId("photo-selection")).toBeVisible();
    await saadPage.getByTestId("photo-caption").fill(albumCaption);
    await saadPage.getByTestId("photo-send").click();
    await revealLatestCaption(saadPage, albumCaption, 120_000);
    const albumBubble = saadPage
      .locator('[data-testid="photo-bubble"]')
      .filter({ hasText: albumCaption });
    await expect(albumBubble).toBeVisible({ timeout: 120_000 });
    await expect(
      saadPage.locator('[data-own="true"]').filter({ hasText: albumCaption }),
    ).toHaveCount(1);
    await expect(
      saadPage.locator('[data-own="true"]').filter({ hasText: albumCaption }),
    ).toHaveAttribute("data-status", /sent|delivered|read/, { timeout: 240_000 });
    await revealLatestCaption(talaPage, albumCaption, 90_000);
    const talaAlbum = talaPage
      .locator('[data-testid="photo-bubble"]')
      .filter({ hasText: albumCaption });
    await expect(talaAlbum).toBeVisible({ timeout: 90_000 });
    await talaAlbum
      .getByRole("button", { name: /Open photo/i })
      .first()
      .click();
    const viewer = talaPage.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible({ timeout: 20_000 });
    await expect(viewer.getByText(/1 of 3/)).toBeVisible();
    await talaPage.getByRole("button", { name: "Next photo" }).click();
    await expect(viewer.getByText(/2 of 3/)).toBeVisible();
    await talaPage.getByRole("button", { name: "Next photo" }).click();
    await expect(viewer.getByText(/3 of 3/)).toBeVisible();
    await talaPage.keyboard.press("Escape");

    // Persistence: reload both — captions + bubbles remain (R2 signed URLs regenerate)
    await saadPage.reload();
    await talaPage.reload();
    await revealLatestCaption(saadPage, saadCaption, 60_000);
    await revealLatestCaption(saadPage, talaCaption, 60_000);
    await revealLatestCaption(saadPage, albumCaption, 60_000);
    await revealLatestCaption(talaPage, saadCaption, 60_000);
    await revealLatestCaption(talaPage, talaCaption, 60_000);
    await revealLatestCaption(talaPage, albumCaption, 60_000);
    await expect(
      saadPage.locator('[data-testid="photo-bubble"]').filter({ hasText: saadCaption }),
    ).toBeVisible();
    await expect(
      talaPage.locator('[data-testid="photo-bubble"]').filter({ hasText: talaCaption }),
    ).toBeVisible();

    // Search finds image captions
    await saadPage.goto(`/search?q=${encodeURIComponent(saadCaption)}`);
    await expect(saadPage.getByTestId("search-results")).toBeVisible({ timeout: 30_000 });
    await expect(saadPage.getByText(saadCaption).first()).toBeVisible({ timeout: 30_000 });

    await saad.close();
    await tala.close();
  });

  test("Shared Media library shows R2 photos after reload and opens viewer", async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    const saad = await browser.newContext();
    const tala = await browser.newContext();
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();
    await saadPage.setViewportSize({ width: 390, height: 844 });
    await talaPage.setViewportSize({ width: 390, height: 844 });

    await loginAs(saadPage, "Saad");
    await loginAs(talaPage, "Tala");

    const saadCaption = `r2-media-saad-${Date.now()}`;
    const talaCaption = `r2-media-tala-${Date.now()}`;
    await sendPhoto(saadPage, fixtureJpeg, saadCaption);
    await revealLatestCaption(talaPage, saadCaption, 90_000);
    await sendPhoto(talaPage, fixturePng, talaCaption);
    await revealLatestCaption(saadPage, talaCaption, 90_000);

    await saadPage.reload();
    await talaPage.reload();
    await revealLatestCaption(saadPage, saadCaption, 60_000);
    await revealLatestCaption(talaPage, talaCaption, 60_000);

    for (const page of [saadPage, talaPage]) {
      await page.goto("/media");
      await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText("Nothing shared yet")).toHaveCount(0);
      const thumbs = page.getByTestId("media-grid").getByTestId("media-thumb");
      await expect(thumbs.first()).toBeVisible();
      expect(await thumbs.count()).toBeGreaterThanOrEqual(2);
      await thumbs.first().click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
      // Opened from Media the viewer also carries jump/album/favorite, so the
      // original lives in the action sheet rather than crowding the dock.
      await page.getByTestId("photo-more-actions").click();
      await expect(page.getByTestId("photo-view-original-menu")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
    }

    await saad.close();
    await tala.close();
  });

  test("Phase 5: real R2 media populates the library and a shared album", async ({ browser }) => {
    test.setTimeout(600_000);

    const saad = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tala = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();

    try {
      await loginAs(saadPage, "Saad");
      await loginAs(talaPage, "Tala");

      const stamp = Date.now();
      const saadCaption = `r2-p5-saad-${stamp}`;
      const talaCaption = `r2-p5-tala-${stamp}`;

      // Multiple real photos in both directions.
      await saadPage.getByTestId("photo-attach").click();
      await saadPage
        .getByTestId("media-input")
        .setInputFiles([fixtureMacScreenshot, fixtureJpeg, fixturePng]);
      await expect(saadPage.getByTestId("photo-selection")).toBeVisible();
      await saadPage.getByTestId("photo-caption").fill(saadCaption);
      await saadPage.getByTestId("photo-send").click();
      await revealLatestCaption(saadPage, saadCaption, 120_000);
      await expect(
        saadPage.locator('[data-own="true"]').filter({ hasText: saadCaption }),
      ).toHaveAttribute("data-status", /sent|delivered|read/, { timeout: 240_000 });
      await sendPhoto(talaPage, fixturePng, talaCaption);

      // Both sessions reload; the library is served from persisted rows.
      await saadPage.reload();
      await talaPage.reload();

      for (const page of [saadPage, talaPage]) {
        await page.goto("/media");
        await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
        await expect(page.getByTestId("media-grid").getByTestId("media-thumb").first()).toBeVisible(
          { timeout: 45_000 },
        );
      }

      // Sender modes split the same persisted source.
      await saadPage.getByTestId("media-mode-you").click();
      await expect(
        saadPage.getByTestId("media-grid").getByTestId("media-thumb").first(),
      ).toBeVisible({ timeout: 45_000 });
      const mine = await saadPage.getByTestId("media-grid").getByTestId("media-thumb").count();
      await saadPage.getByTestId("media-mode-partner").click();
      await expect(
        saadPage.getByTestId("media-grid").getByTestId("media-thumb").first(),
      ).toBeVisible({ timeout: 45_000 });
      const theirs = await saadPage.getByTestId("media-grid").getByTestId("media-thumb").count();
      expect(mine).toBeGreaterThan(0);
      expect(theirs).toBeGreaterThan(0);
      await saadPage.getByTestId("media-mode-all").click();

      // Album from real R2 media: title, note, photos, cover.
      const title = `R2 album ${stamp}`;
      await saadPage.getByTestId("media-mode-albums").click();
      await expect(saadPage.getByTestId("albums-home")).toBeVisible({ timeout: 45_000 });
      await saadPage.getByTestId("album-create-open").first().click();
      await saadPage.getByTestId("album-title-input").fill(title);
      await saadPage.getByTestId("album-note-input").fill("من R2 — straight from storage ❤️");
      await saadPage.getByTestId("album-create-continue").click();
      const choices = saadPage.getByTestId("media-select-tile");
      await expect(choices.first()).toBeVisible({ timeout: 45_000 });
      await choices.nth(0).click();
      await choices.nth(1).click();
      await choices.nth(2).click();
      await saadPage.getByTestId("album-create-submit").click();
      await expect(saadPage.getByTestId("album-detail")).toBeVisible({ timeout: 45_000 });

      await saadPage.getByTestId("album-actions-open").click();
      await saadPage.getByTestId("album-cover-open").click();
      const coverChoices = saadPage.getByTestId("album-cover-choice");
      const coverId = await coverChoices.nth(2).getAttribute("data-media-id");
      await coverChoices.nth(2).click();
      await expect(coverChoices.nth(2)).toHaveAttribute("aria-pressed", "true", {
        timeout: 30_000,
      });
      await saadPage.keyboard.press("Escape");

      // Reload: album, note and cover all come back from the database.
      await saadPage.reload();
      await expect(saadPage.getByTestId("album-detail")).toBeVisible({ timeout: 45_000 });
      await expect(saadPage.getByTestId("album-title")).toHaveText(title);
      await expect(saadPage.getByTestId("album-note")).toContainText("straight from storage");
      await expect(saadPage.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(3);
      await saadPage.getByTestId("album-actions-open").click();
      await saadPage.getByTestId("album-cover-open").click();
      await expect(
        saadPage.locator(`[data-testid="album-cover-choice"][data-media-id="${coverId}"]`),
      ).toHaveAttribute("aria-pressed", "true");
      await saadPage.keyboard.press("Escape");

      // Viewer serves the real original through a signed URL.
      const albumThumb = saadPage.getByTestId("album-grid").getByTestId("media-thumb").first();
      const mediaId = await albumThumb.getAttribute("data-media-id");
      await albumThumb.click();
      await expect(saadPage.getByTestId("photo-viewer")).toBeVisible({ timeout: 30_000 });
      await saadPage.getByTestId("photo-more-actions").click();
      await saadPage.getByTestId("photo-view-original-menu").click();
      await expect(saadPage.getByText("Showing original")).toBeVisible({ timeout: 45_000 });

      // Jump to message from the viewer lands on the original chat message.
      await saadPage.getByTestId("photo-more-actions").click();
      await saadPage.getByTestId("photo-jump-to-message").click();
      await expect(saadPage).toHaveURL(/\/chat\?focus=/, { timeout: 45_000 });
      await expect(saadPage.getByText(saadCaption).first()).toBeVisible({ timeout: 60_000 });

      // Deleting the album keeps every photo in the shared library.
      await saadPage.goto("/media?view=albums");
      await saadPage.getByTestId("album-card").filter({ hasText: title }).first().click();
      await expect(saadPage.getByTestId("album-detail")).toBeVisible({ timeout: 45_000 });
      await saadPage.getByTestId("album-actions-open").click();
      await saadPage.getByTestId("album-delete-open").click();
      await saadPage.getByTestId("album-delete-confirm").click();
      await expect(saadPage.getByTestId("albums-home")).toBeVisible({ timeout: 45_000 });

      await saadPage.getByTestId("media-mode-all").click();
      await expect(
        saadPage
          .getByTestId("media-grid")
          .locator(`[data-testid="media-thumb"][data-media-id="${mediaId}"]`),
      ).toBeVisible({ timeout: 45_000 });
    } finally {
      await saad.close();
      await tala.close();
    }
  });

  test("Phase 5: favorites on real R2 media derive Loved by both", async ({ browser }) => {
    test.setTimeout(300_000);

    const saad = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tala = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();

    try {
      await loginAs(saadPage, "Saad");
      await loginAs(talaPage, "Tala");
      await sendPhoto(saadPage, fixtureMacScreenshot, `r2-p5-heart-${Date.now()}`);

      await saadPage.goto("/media");
      await expect(saadPage.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
      const mediaId = await saadPage
        .getByTestId("media-grid")
        .getByTestId("media-thumb")
        .first()
        .getAttribute("data-media-id");

      const setFavorite = async (page: Page, favorited: boolean) => {
        const control = page
          .getByTestId("media-grid")
          .locator(`[data-testid="media-favorite"][data-media-id="${mediaId}"]`);
        await expect(control).toBeVisible({ timeout: 45_000 });
        if ((await control.getAttribute("aria-pressed")) === String(favorited)) return;
        const settled = page.waitForResponse((response) =>
          response.url().includes(`/api/media/${mediaId}/favorite`),
        );
        await control.click();
        await settled;
        await expect(control).toHaveAttribute("aria-pressed", String(favorited));
      };

      for (const page of [saadPage, talaPage]) {
        await page.goto("/media");
        await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
        await setFavorite(page, false);
        await setFavorite(page, true);
      }

      // Survives reload, and both hearts derive the shared section.
      await saadPage.reload();
      await expect(saadPage.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
      await expect(
        saadPage
          .getByTestId("media-grid")
          .locator(`[data-testid="media-favorite"][data-media-id="${mediaId}"]`),
      ).toHaveAttribute("aria-pressed", "true", { timeout: 45_000 });
      await expect(saadPage.getByTestId("loved-by-both")).toBeVisible({ timeout: 60_000 });
      await expect(
        saadPage.getByTestId("loved-by-both").locator(`[data-media-id="${mediaId}"]`).first(),
      ).toBeVisible();

      // Leave the library as we found it.
      for (const page of [saadPage, talaPage]) {
        await page.goto("/media");
        await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 45_000 });
        await setFavorite(page, false);
      }
    } finally {
      await saad.close();
      await tala.close();
    }
  });
});
