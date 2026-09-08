import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { DESKTOP, loginAs, MOBILE, openMedia, sendPhotos, waitForGrid } from "./helpers/media";

/**
 * Phase 5 visual capture for the shared media library. Writes to
 * test-results/media-ux/ for designer review — these are not pixel diffs.
 */
const fixtures = path.join(__dirname, "fixtures");
const portrait = path.join(fixtures, "portrait.png");
const landscape = path.join(fixtures, "landscape.png");
const square = path.join(fixtures, "square.png");
const tall = path.join(fixtures, "tall.png");
const wide = path.join(fixtures, "wide.png");
const micro = path.join(fixtures, "micro.png");
/** Photograph-like frames so the grid can be judged as a photo surface. */
const memories = [1, 2, 3, 4, 5, 6].map((n) => path.join(fixtures, `memory${n}.png`));

// Outside test-results so a later Playwright run can't sweep the review set away.
const outDir = path.join(__dirname, "..", "visual-qa", "media");

async function shot(page: Page, name: string, fullPage = false) {
  fs.mkdirSync(outDir, { recursive: true });
  // Let crossfades and sheet springs land before the shutter.
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
}

async function ensureLibrary(page: Page) {
  await openMedia(page);
  await waitForGrid(page);
  // Thumbnails resolve through signed URLs; wait for pixels, not markup.
  await page
    .locator('[data-testid="media-thumb"] img')
    .first()
    .evaluate((node: HTMLImageElement) =>
      node.complete ? true : new Promise((resolve) => node.addEventListener("load", resolve)),
    );
}

async function openAlbumNamed(page: Page, title: string) {
  await page.getByTestId("media-mode-albums").click();
  await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("album-card").filter({ hasText: title }).first().click();
  await expect(page.getByTestId("album-detail")).toBeVisible({ timeout: 30_000 });
}

const SEEDED = {
  many: "Our summer, the long one — every single day of it",
  arabic: "ذكرياتنا",
  single: "One frame",
  empty: "Still empty",
};

test.describe.configure({ mode: "serial" });

test.describe("phase 5 media visual capture", () => {
  test("seed: assorted aspect ratios and album shapes", async ({ browser }) => {
    // Real uploads plus album rebuilds; generous so a slow R2 leg can't fail it.
    test.setTimeout(600_000);
    const saadContext = await browser.newContext({ viewport: MOBILE });
    const talaContext = await browser.newContext({ viewport: MOBILE });
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();

    try {
      await loginAs(saad, "Saad");
      await loginAs(tala, "Tala");

      const stamp = Date.now();
      await sendPhotos(saad, [portrait, landscape, square], `shapes ${stamp}`);
      await sendPhotos(tala, [tall, wide], `tall and wide ${stamp}`);
      await sendPhotos(saad, micro, `tiny source ${stamp}`);
      await sendPhotos(tala, memories.slice(0, 3), `the coast ${stamp}`);
      await sendPhotos(saad, memories.slice(3), `walking home ${stamp}`);

      await openMedia(saad);
      await waitForGrid(saad);

      // Albums covering the shapes we need to review: many, single, empty, Arabic.
      const build = async (title: string, note: string, count: number) => {
        await saad.getByTestId("media-mode-albums").click();
        await expect(saad.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
        await saad.getByTestId("album-create-open").first().click();
        await saad.getByTestId("album-title-input").fill(title);
        if (note) await saad.getByTestId("album-note-input").fill(note);
        await saad.getByTestId("album-create-continue").click();
        if (count > 0) {
          const tiles = saad.getByTestId("media-select-tile");
          await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
          const available = Math.min(count, await tiles.count());
          for (let index = 0; index < available; index += 1) await tiles.nth(index).click();
        }
        await saad.getByTestId("album-create-submit").click();
        await expect(saad.getByTestId("album-detail")).toBeVisible({ timeout: 30_000 });
        await saad.getByTestId("album-back").click();
        await expect(saad.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
      };

      // Start from no albums so covers come from this run's photographs.
      await saad.getByTestId("media-mode-albums").click();
      await expect(saad.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
      // Wait for the list to settle — an unloaded query would look empty.
      await expect(
        saad.locator('[data-testid="album-card"], [data-testid="albums-empty"]').first(),
      ).toBeVisible({ timeout: 30_000 });
      const staleIds = (
        await saad
          .getByTestId("album-card")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-album-id") ?? ""))
      ).slice(0, 8);
      for (const staleId of staleIds) {
        // Deep link per album: clicking a list that is re-flowing mid-delete is
        // a test-only race, not something a person can hit.
        await openMedia(saad, `?view=albums&album=${staleId}`);
        await expect(saad.getByTestId("album-detail")).toBeVisible({ timeout: 30_000 });
        await saad.getByTestId("album-actions-open").click();
        await saad.getByTestId("album-delete-open").click();
        await saad.getByTestId("album-delete-confirm").click();
        await expect(saad.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
      }

      await build(SEEDED.many, "that week we photographed everything ❤️", 6);
      await build(SEEDED.single, "just the one", 1);
      await build(SEEDED.empty, "", 0);
      await build(SEEDED.arabic, "أجمل أسبوع — best week ❤️", 3);

      // A couple of hearts so "Loved by both" has something to render.
      await saad.getByTestId("media-mode-all").click();
      await waitForGrid(saad);
      const mediaId = await saad
        .getByTestId("media-grid")
        .getByTestId("media-thumb")
        .first()
        .getAttribute("data-media-id");

      for (const session of [saad, tala]) {
        await openMedia(session);
        await waitForGrid(session);
        const heart = session
          .getByTestId("media-grid")
          .locator(`[data-testid="media-favorite"][data-media-id="${mediaId}"]`);
        await expect(heart).toBeVisible({ timeout: 20_000 });
        if ((await heart.getAttribute("aria-pressed")) !== "true") {
          const settled = session.waitForResponse((response) =>
            response.url().includes(`/api/media/${mediaId}/favorite`),
          );
          await heart.click();
          await settled;
        }
      }
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("mobile light", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await ensureLibrary(page);
    await shot(page, "mobile-light-all");
    await shot(page, "mobile-light-all-full", true);

    await page.getByTestId("media-mode-partner").click();
    await waitForGrid(page);
    await shot(page, "mobile-light-sender");

    await page.getByTestId("media-mode-all").click();
    await waitForGrid(page);
    await page.getByTestId("media-filters-open").click();
    await expect(page.getByTestId("media-filters-apply")).toBeVisible();
    await shot(page, "mobile-light-filters");
    await page.keyboard.press("Escape");

    // Empty state through a range that predates the conversation.
    await openMedia(page, "?from=2020-01-01&to=2020-01-05");
    await expect(page.getByTestId("media-empty")).toBeVisible({ timeout: 30_000 });
    await shot(page, "mobile-light-empty-filtered");

    await openMedia(page);
    await waitForGrid(page);
    await page.getByTestId("media-thumb").first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
    await shot(page, "mobile-light-viewer");
    await page.getByTestId("photo-more-actions").click();
    await shot(page, "mobile-light-viewer-actions");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.getByTestId("media-mode-albums").click();
    await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
    await shot(page, "mobile-light-albums");
    await shot(page, "mobile-light-albums-full", true);

    // Card close-ups: RTL title alignment and the coverless card are easy to
    // misread at page scale.
    for (const [name, title] of [
      ["arabic", SEEDED.arabic],
      ["long", SEEDED.many],
      ["empty", SEEDED.empty],
    ] as const) {
      const card = page.getByTestId("album-card").filter({ hasText: title }).first();
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await card.screenshot({ path: path.join(outDir, `mobile-light-card-${name}.png`) });
    }

    await page.getByTestId("album-create-open").first().click();
    await expect(page.getByTestId("album-title-input")).toBeVisible();
    await page.getByTestId("album-title-input").fill("Late nights");
    await page.getByTestId("album-note-input").fill("the quiet ones");
    await shot(page, "mobile-light-album-create");
    await page.getByTestId("album-create-continue").click();
    await expect(page.getByTestId("media-select-tile").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("media-select-tile").nth(0).click();
    await page.getByTestId("media-select-tile").nth(1).click();
    await shot(page, "mobile-light-album-select");
    await page.keyboard.press("Escape");

    await openAlbumNamed(page, SEEDED.many);
    await shot(page, "mobile-light-album-detail");
    await shot(page, "mobile-light-album-detail-full", true);
    await page.getByTestId("album-actions-open").click();
    await shot(page, "mobile-light-album-actions");
    await page.keyboard.press("Escape");

    await page.getByTestId("album-back").click();
    await openAlbumNamed(page, SEEDED.single);
    await shot(page, "mobile-light-album-single");
    await page.getByTestId("album-back").click();
    await openAlbumNamed(page, SEEDED.empty);
    await shot(page, "mobile-light-album-empty");
    await page.getByTestId("album-back").click();
    await openAlbumNamed(page, SEEDED.arabic);
    await shot(page, "mobile-light-album-arabic");
  });

  test("mobile dark", async ({ browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({ viewport: MOBILE, colorScheme: "dark" });
    const page = await context.newPage();
    try {
      await loginAs(page, "Saad");
      await ensureLibrary(page);
      await shot(page, "mobile-dark-all");

      await page.getByTestId("media-filters-open").click();
      await expect(page.getByTestId("media-filters-apply")).toBeVisible();
      await shot(page, "mobile-dark-filters");
      await page.keyboard.press("Escape");

      await page.getByTestId("media-thumb").first().click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
      await shot(page, "mobile-dark-viewer");
      await page.keyboard.press("Escape");

      await page.getByTestId("media-mode-albums").click();
      await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
      await shot(page, "mobile-dark-albums");

      await openAlbumNamed(page, SEEDED.many);
      await shot(page, "mobile-dark-album-detail");
    } finally {
      await context.close();
    }
  });

  test("desktop light", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    await ensureLibrary(page);
    await shot(page, "desktop-light-all");

    await page.getByTestId("media-filters-open").click();
    await expect(page.getByTestId("media-filters-apply")).toBeVisible();
    await shot(page, "desktop-light-filters");
    await page.keyboard.press("Escape");

    await page.getByTestId("media-thumb").first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
    await shot(page, "desktop-light-viewer");
    await page.keyboard.press("Escape");

    await page.getByTestId("media-mode-albums").click();
    await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
    await shot(page, "desktop-light-albums");

    await page.getByTestId("album-create-open").first().click();
    await expect(page.getByTestId("album-title-input")).toBeVisible();
    await shot(page, "desktop-light-album-create");
    await page.keyboard.press("Escape");

    await openAlbumNamed(page, SEEDED.many);
    await shot(page, "desktop-light-album-detail");
    await page.getByTestId("album-actions-open").click();
    await shot(page, "desktop-light-album-actions");
  });

  test("desktop dark", async ({ browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({ viewport: DESKTOP, colorScheme: "dark" });
    const page = await context.newPage();
    try {
      await loginAs(page, "Saad");
      await ensureLibrary(page);
      await shot(page, "desktop-dark-all");

      await page.getByTestId("media-thumb").first().click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
      await shot(page, "desktop-dark-viewer");
      await page.keyboard.press("Escape");

      await page.getByTestId("media-mode-albums").click();
      await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
      await shot(page, "desktop-dark-albums");

      await openAlbumNamed(page, SEEDED.arabic);
      await shot(page, "desktop-dark-album-arabic");
    } finally {
      await context.close();
    }
  });
});
