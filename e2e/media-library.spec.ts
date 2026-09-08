import { expect, test } from "@playwright/test";

import {
  createAlbum,
  DESKTOP,
  fixtureJpeg,
  fixturePng,
  gridThumbs,
  loginAs,
  MOBILE,
  openMedia,
  sendPhotos,
  waitForGrid,
} from "./helpers/media";

/**
 * Phase 5 shared media, memories, and albums.
 * Runs against the configured storage provider; real R2 acceptance lives in
 * photos-r2-acceptance.spec.ts.
 */
test.describe("phase 5 media library", () => {
  test("A. photos persist into Media and survive reload for both people", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext({ viewport: MOBILE });
    const talaContext = await browser.newContext({ viewport: MOBILE });
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();

    try {
      await loginAs(saad, "Saad");
      await loginAs(tala, "Tala");

      const marker = `p5-persist-${Date.now()}`;
      await sendPhotos(saad, fixtureJpeg, marker);

      await openMedia(saad);
      await waitForGrid(saad);
      await expect(saad.getByText("Nothing shared yet")).toHaveCount(0);

      await saad.reload();
      await waitForGrid(saad);

      // Tala's session reaches the same persisted library.
      await openMedia(tala);
      await waitForGrid(tala);
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("B. sender modes show only that person's photos", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext({ viewport: MOBILE });
    const talaContext = await browser.newContext({ viewport: MOBILE });
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();

    try {
      await loginAs(saad, "Saad");
      await loginAs(tala, "Tala");
      await sendPhotos(saad, fixtureJpeg, `p5-from-saad-${Date.now()}`);
      await sendPhotos(tala, fixturePng, `p5-from-tala-${Date.now()}`);

      await openMedia(saad);
      await waitForGrid(saad);
      const allCount = await gridThumbs(saad).count();

      await saad.getByTestId("media-mode-you").click();
      await expect(saad).toHaveURL(/view=you/);
      await waitForGrid(saad);
      const mineCount = await gridThumbs(saad).count();

      await saad.getByTestId("media-mode-partner").click();
      await expect(saad).toHaveURL(/view=partner/);
      await waitForGrid(saad);
      const theirsCount = await gridThumbs(saad).count();

      expect(mineCount).toBeGreaterThan(0);
      expect(theirsCount).toBeGreaterThan(0);
      expect(allCount).toBeGreaterThanOrEqual(Math.max(mineCount, theirsCount));

      // Mode is URL state, so a reload keeps you where you were.
      await saad.reload();
      await expect(saad).toHaveURL(/view=partner/);
      await expect(saad.getByTestId("media-mode-partner")).toHaveAttribute("aria-current", "page");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("C. viewer opens from a thumbnail, navigates, and closes", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, [fixtureJpeg, fixturePng], `p5-viewer-${Date.now()}`);

    await openMedia(page);
    await waitForGrid(page);
    await gridThumbs(page).first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Next photo" }).click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
  });

  test("D. jump to message lands on the original chat message", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const marker = `p5-jump-${Date.now()}`;
    await sendPhotos(page, fixtureJpeg, marker);

    await openMedia(page);
    await waitForGrid(page);
    await gridThumbs(page).first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("photo-more-actions").click();
    await page.getByTestId("photo-jump-to-message").click();

    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 20_000 });
    await expect(page).toHaveURL(/from=media/);
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
  });

  test("E. album creation persists across reload", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, [fixtureJpeg, fixturePng], `p5-album-src-${Date.now()}`);

    const title = `Summer ${Date.now()}`;
    await openMedia(page);
    await createAlbum(page, title, "that week ❤️", 2);

    await expect(page.getByTestId("album-title")).toHaveText(title);
    await expect(page.getByTestId("album-note")).toContainText("that week");
    await expect(page.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(2);

    await page.reload();
    await expect(page.getByTestId("album-detail")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("album-title")).toHaveText(title);
    await expect(page.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(2);

    await page.getByTestId("album-back").click();
    await expect(page.getByTestId("albums-home")).toBeVisible();
    await expect(page.getByTestId("album-card").filter({ hasText: title })).toBeVisible();

    // Browser Back closes an opened album rather than leaving Media.
    await page.getByTestId("album-card").filter({ hasText: title }).click();
    await expect(page.getByTestId("album-detail")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("albums-home")).toBeVisible();
  });

  test("F/G/H/K. note, cover, remove, and delete behave as promised", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const marker = `p5-album-ops-${Date.now()}`;
    await sendPhotos(page, [fixtureJpeg, fixturePng], marker);

    const title = `Ops ${Date.now()}`;
    await openMedia(page);
    await createAlbum(page, title, "", 2);

    // F. note edit persists.
    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-edit-open").click();
    await page.getByTestId("album-edit-note").fill("أجمل أسبوع — best week");
    await page.getByTestId("album-edit-save").click();
    await expect(page.getByTestId("album-note")).toContainText("best week");
    await page.reload();
    await expect(page.getByTestId("album-note")).toContainText("أجمل أسبوع", {
      timeout: 30_000,
    });

    // G. cover change sticks.
    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-cover-open").click();
    const coverChoices = page.getByTestId("album-cover-choice");
    const secondId = await coverChoices.nth(1).getAttribute("data-media-id");
    await coverChoices.nth(1).click();
    await expect(coverChoices.nth(1)).toHaveAttribute("aria-pressed", "true", {
      timeout: 20_000,
    });
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-cover-open").click();
    await expect(
      page.getByTestId("album-cover-choice").filter({ has: page.locator(`[data-media-id]`) }),
    ).toBeTruthy();
    await expect(
      page.locator(`[data-testid="album-cover-choice"][data-media-id="${secondId}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    // H. removing from the album leaves the photo in All media and in chat.
    const removedId = await page
      .getByTestId("album-grid")
      .getByTestId("media-thumb")
      .first()
      .getAttribute("data-media-id");
    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-remove-open").click();
    await page.locator(`[data-testid="album-remove-choice"][data-media-id="${removedId}"]`).click();
    await page.getByTestId("album-remove-submit").click();
    await expect(page.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(1);

    await page.getByTestId("album-back").click();
    await page.getByTestId("media-mode-all").click();
    await waitForGrid(page);
    // Scoped to the main grid — a favorited photo also appears in Loved by both.
    const inAllMedia = page
      .getByTestId("media-grid")
      .locator(`[data-testid="media-thumb"][data-media-id="${removedId}"]`);
    await expect(inAllMedia).toBeVisible({ timeout: 20_000 });

    // K. deleting the album keeps the photos.
    await page.getByTestId("media-mode-albums").click();
    await page.getByTestId("album-card").filter({ hasText: title }).click();
    await expect(page.getByTestId("album-detail")).toBeVisible();
    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-delete-open").click();
    await expect(page.getByText("They will stay in your chat.")).toBeVisible();
    await page.getByTestId("album-delete-confirm").click();

    await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("album-card").filter({ hasText: title })).toHaveCount(0);

    await page.getByTestId("media-mode-all").click();
    await waitForGrid(page);
    await expect(inAllMedia).toBeVisible();
  });

  test("I/J/L. favorites persist, loved-by-both appears, partner converges", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const saadContext = await browser.newContext({ viewport: MOBILE });
    const talaContext = await browser.newContext({ viewport: MOBILE });
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();

    try {
      await loginAs(saad, "Saad");
      await loginAs(tala, "Tala");
      await sendPhotos(saad, fixtureJpeg, `p5-hearts-${Date.now()}`);

      await openMedia(saad);
      await waitForGrid(saad);
      const target = saad.getByTestId("media-grid").getByTestId("media-thumb").first();
      const mediaId = await target.getAttribute("data-media-id");
      expect(mediaId).toBeTruthy();

      // Scoped to the main grid: the Loved by both row renders the same photo.
      const heartIn = (session: typeof saad) =>
        session
          .getByTestId("media-grid")
          .locator(`[data-testid="media-favorite"][data-media-id="${mediaId}"]`);

      const setFavorite = async (session: typeof saad, favorited: boolean) => {
        const control = heartIn(session);
        await expect(control).toBeVisible({ timeout: 20_000 });
        if ((await control.getAttribute("aria-pressed")) === String(favorited)) return null;
        const settled = session.waitForResponse((response) =>
          response.url().includes(`/api/media/${mediaId}/favorite`),
        );
        await control.click();
        const response = await settled;
        await expect(control).toHaveAttribute("aria-pressed", String(favorited));
        return response;
      };

      // Earlier runs may have left hearts behind; start from a known state.
      await setFavorite(saad, false);
      const saved = await setFavorite(saad, true);
      expect(saved?.status()).toBe(200);

      // I. persists across reload.
      await saad.reload();
      await waitForGrid(saad);
      await expect(heartIn(saad)).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

      // L. Tala's session converges without a hard refresh.
      await openMedia(tala);
      await waitForGrid(tala);
      await setFavorite(tala, false);
      const talaSaved = await setFavorite(tala, true);
      expect(talaSaved?.status()).toBe(200);

      // J. loved by both surfaces on Saad's side after reconciliation.
      await expect(saad.getByTestId("loved-by-both")).toBeVisible({ timeout: 30_000 });
      await expect(
        saad.getByTestId("loved-by-both").locator(`[data-media-id="${mediaId}"]`).first(),
      ).toBeVisible();

      // Filtering to "loved by both" returns the same photo.
      await saad.getByTestId("media-filters-open").click();
      await saad.getByTestId("media-filter-both").click();
      await saad.getByTestId("media-filters-apply").click();
      await expect(saad).toHaveURL(/hearts=both/);
      await waitForGrid(saad);
      await expect(
        saad.locator(`[data-testid="media-thumb"][data-media-id="${mediaId}"]`),
      ).toBeVisible({ timeout: 20_000 });

      // Cleanup so later runs start neutral.
      await openMedia(saad);
      await waitForGrid(saad);
      await setFavorite(saad, false);
      await setFavorite(tala, false);
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("filters apply only after Apply and can be cleared", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, fixtureJpeg, `p5-filters-${Date.now()}`);

    await openMedia(page);
    await waitForGrid(page);

    await page.getByTestId("media-filters-open").click();
    await page.getByTestId("media-filter-oldest").click();
    // Draft only — the URL must not change until Apply.
    await expect(page).not.toHaveURL(/sort=oldest/);
    await page.getByTestId("media-filters-apply").click();
    await expect(page).toHaveURL(/sort=oldest/);
    await expect(page.getByTestId("media-filter-chip-sort")).toBeVisible();

    await page.getByTestId("media-filter-chip-sort").click();
    await expect(page).not.toHaveURL(/sort=oldest/);
  });

  test("M. complete core flow at 390px without horizontal overflow", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, [fixtureJpeg, fixturePng], `p5-mobile-${Date.now()}`);

    await openMedia(page);
    await waitForGrid(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Grid tiles clear the 44px comfortable target.
    const box = await gridThumbs(page).first().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.getByTestId("media-mode-albums").click();
    await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
    const albumsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(albumsOverflow).toBeLessThanOrEqual(1);
  });

  test("N. dark mode keeps media surfaces readable", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: MOBILE, colorScheme: "dark" });
    const page = await context.newPage();
    try {
      await loginAs(page, "Saad");
      await sendPhotos(page, fixtureJpeg, `p5-dark-${Date.now()}`);
      await openMedia(page);
      await waitForGrid(page);
      await expect(page.getByTestId("media-mode-all")).toBeVisible();
      await page.getByTestId("media-mode-albums").click();
      await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.close();
    }
  });

  test("O. Arabic album title and mixed note render without breaking layout", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, fixtureJpeg, `p5-arabic-${Date.now()}`);

    const title = `ذكرياتنا ${Date.now()}`;
    await openMedia(page);
    await createAlbum(page, title, "أجمل أسبوع — best week ❤️", 1);

    const heading = page.getByTestId("album-title");
    await expect(heading).toHaveText(title);
    // The header block derives its direction from the title, so the count and
    // note sit on the same edge as an Arabic name.
    await expect(heading.evaluate((node) => getComputedStyle(node).direction)).resolves.toBe("rtl");
    await expect(
      page.getByTestId("album-note").evaluate((node) => getComputedStyle(node).direction),
    ).resolves.toBe("rtl");
    await expect(page.getByTestId("album-note")).toHaveAttribute("dir", "auto");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByTestId("album-actions-open").click();
    await page.getByTestId("album-delete-open").click();
    await page.getByTestId("album-delete-confirm").click();
    await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
  });

  test("P. reduced motion keeps overlays and the viewer usable", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: MOBILE,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await loginAs(page, "Saad");
      await sendPhotos(page, fixtureJpeg, `p5-reduced-${Date.now()}`);
      await openMedia(page);
      await waitForGrid(page);

      await page.getByTestId("media-filters-open").click();
      await expect(page.getByTestId("media-filters-apply")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("media-filters-apply")).toHaveCount(0, { timeout: 15_000 });

      await gridThumbs(page).first().click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("photo-viewer")).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test("accessibility: overlays trap focus and restore it on close", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendPhotos(page, fixtureJpeg, `p5-a11y-${Date.now()}`);
    await openMedia(page);
    await waitForGrid(page);

    const trigger = page.getByTestId("media-filters-open");
    await trigger.click();
    const sheet = page.getByTestId("shhh-sheet");
    await expect(sheet).toBeVisible();

    // Focus moves into the overlay and cycles inside it.
    await expect(async () => {
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="shhh-sheet"]');
        return Boolean(panel && document.activeElement && panel.contains(document.activeElement));
      });
      expect(inside).toBe(true);
    }).toPass({ timeout: 5_000 });

    for (let i = 0; i < 14; i += 1) await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="shhh-sheet"]');
      return Boolean(panel && document.activeElement && panel.contains(document.activeElement));
    });
    expect(stillInside).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("desktop uses a wide centered composition, not stretched phone tiles", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    await sendPhotos(page, fixtureJpeg, `p5-desktop-${Date.now()}`);
    await openMedia(page);
    await waitForGrid(page);

    const main = await page.locator("main").boundingBox();
    expect(main?.width ?? 0).toBeLessThan(DESKTOP.width);
    // Centered, not left-hugging.
    expect(Math.abs((main?.x ?? 0) - (DESKTOP.width - (main?.width ?? 0)) / 2)).toBeLessThan(24);

    const tile = await gridThumbs(page).first().boundingBox();
    expect(tile?.width ?? 0).toBeLessThan(320);
  });
});
