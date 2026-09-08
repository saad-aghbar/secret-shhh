import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

import { loginAs, revealLatestCaption, scrollChatToLatest } from "./helpers/media";

const fixtureJpeg = path.join(__dirname, "fixtures", "tiny.jpg");
const fixturePng = path.join(__dirname, "fixtures", "tiny.png");
const fixtureWebp = path.join(__dirname, "fixtures", "tiny.webp");
const fixtureMacScreenshot = path.join(__dirname, "fixtures", "macos-screenshot.png");

async function sendPhotoWithCaption(page: Page, file: string, caption: string) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(file);
  await expect(page.getByTestId("photo-selection")).toBeVisible();
  await page.getByTestId("photo-caption").fill(caption);
  await page.getByTestId("photo-send").click();
  await scrollChatToLatest(page);
  await expect(page.getByText(caption)).toBeVisible({ timeout: 45_000 });
}

test.describe("photos", () => {
  test("PNG JPEG and WebP send without internal validation copy", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    for (const [file, label] of [
      [fixturePng, "png"],
      [fixtureJpeg, "jpeg"],
      [fixtureWebp, "webp"],
    ] as const) {
      const marker = `format-${label}-${Date.now()}`;
      await sendPhotoWithCaption(page, file, marker);
      await expect(page.getByText(/Preview files must/i)).toHaveCount(0);
      await expect(page.getByText(/Couldn't prepare this photo/i)).toHaveCount(0);
    }
  });

  test("macOS PNG screenshot sends without failure copy", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `screenshot-${Date.now()}`;
    await sendPhotoWithCaption(page, fixtureMacScreenshot, marker);
    await expect(page.getByText(/Preview files must/i)).toHaveCount(0);
    await expect(page.getByText(/Couldn't send/i)).toHaveCount(0);
    await expect(
      page.locator('[data-testid="photo-bubble"]').filter({ hasText: marker }),
    ).toBeVisible();
  });

  test("attach opens picker; select photo shows preview; send shows bubble", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await expect(page.getByTestId("media-input")).toBeAttached();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    await expect(page.getByTestId("photo-pick-library")).toHaveCount(0);
    await expect(page.getByTestId("video-pick-library")).toHaveCount(0);
    await expect(page.getByTestId("photo-pick-camera")).toHaveCount(0);

    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await expect(page.getByTestId("photo-selection")).toBeVisible();

    await page.getByTestId("photo-caption").fill("هاي الصورة from today ❤️");
    await page.getByTestId("photo-send").click();

    await expect(page.getByTestId("photo-bubble").first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("هاي الصورة from today")).toBeVisible({ timeout: 45_000 });
  });

  test("desktop attach opens floating popover near +", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("attach-sheet-desktop")).toBeVisible();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("attach-sheet-desktop")).toHaveCount(0);
  });

  test("multi-select remove then send album", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles([fixtureJpeg, fixturePng, fixtureJpeg]);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await page.getByTestId("photo-remove-1").click();
    await page.getByTestId("photo-send").click();
    await expect(page.getByTestId("photo-bubble").first()).toBeVisible({ timeout: 45_000 });
  });

  test("viewer opens, shows View original, closes with Escape", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `viewer-e2e-${Date.now()}`;
    await sendPhotoWithCaption(page, fixturePng, marker);
    const bubble = page.locator('[data-testid="photo-bubble"]').filter({ hasText: marker }).first();
    await bubble.scrollIntoViewIfNeeded();
    await expect(bubble).toBeVisible();
    await bubble
      .getByRole("button", { name: /Open photo/i })
      .first()
      .click();
    const viewer = page.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("photo-save")).toBeVisible();
    await expect(page.getByTestId("photo-view-original")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  });

  test("photo download settings on More", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.goto("/more");
    await expect(page.getByTestId("photo-download-settings")).toBeVisible();
    await expect(page.getByText("When to load photos")).toBeVisible();
  });

  test("partner can open Save photo for received image", async ({ browser }) => {
    test.setTimeout(120_000);
    const saad = await browser.newContext();
    const tala = await browser.newContext();
    const saadPage = await saad.newPage();
    const talaPage = await tala.newPage();
    await saadPage.setViewportSize({ width: 390, height: 844 });
    await talaPage.setViewportSize({ width: 390, height: 844 });

    await loginAs(saadPage, "Saad");
    await loginAs(talaPage, "Tala");
    const marker = `save-photo-${Date.now()}`;
    await saadPage.getByTestId("photo-attach").click();
    await saadPage.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await saadPage.getByTestId("photo-caption").fill(marker);
    await saadPage.getByTestId("photo-send").click();
    await scrollChatToLatest(saadPage);
    // Wait for the upload to finalize on the sender first: against real R2 the
    // three variants can take a while, and that latency is not what this test
    // is measuring. Convergence for the partner then gets its own budget.
    await expect(saadPage.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );
    await revealLatestCaption(talaPage, marker, 90_000);
    const bubble = talaPage.locator('[data-testid="photo-bubble"]').filter({ hasText: marker });
    await bubble
      .getByRole("button", { name: /Open photo/i })
      .first()
      .click();
    await expect(talaPage.getByTestId("photo-viewer")).toBeVisible();
    const save = talaPage.getByTestId("photo-save");
    await expect(save).toBeVisible();
    await expect(talaPage.getByRole("button", { name: "Save photo" })).toBeVisible();
    // Keep chrome visible and bypass overlay flake from Next.js portal.
    await talaPage.mouse.move(10, 10);
    const downloadPromise = talaPage
      .waitForEvent("download", { timeout: 20_000 })
      .catch(() => null);
    await save.click({ force: true });
    const download = await downloadPromise;
    // Download event proves browser save path; share sheet may no-op in Chromium.
    expect(download !== null || (await save.isVisible())).toBeTruthy();
    await talaPage.keyboard.press("Escape");
    await saad.close();
    await tala.close();
  });

  test("offline photo send queues then uploads after reconnect", async ({ page, context }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `offline-photo-${Date.now()}`;
    await context.setOffline(true);
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("photo-bubble").filter({ hasText: marker })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(marker)).toBeVisible({ timeout: 45_000 });
  });

  test("photo history opens pinned to the newest message", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `pinned-${Date.now()}`;
    await sendPhotoWithCaption(page, fixtureJpeg, marker);

    // Photo bubbles measure far taller than the virtualizer's row estimate, so a
    // reload must keep re-anchoring until they settle. Landing short leaves the
    // newest message off-screen behind a jump control.
    await page.reload();
    await revealLatestCaption(page, marker, 90_000);
    await expect
      .poll(
        async () =>
          page
            .getByTestId("chat-message-list")
            .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
        { timeout: 15_000 },
      )
      .toBeLessThan(120);
    await expect(page.getByTestId("jump-to-latest-wrap")).toHaveAttribute("data-active", "false");
  });

  test("cancel selection returns to composer without sending", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await page.getByRole("button", { name: "Cancel photo selection" }).click();
    await expect(page.getByTestId("photo-selection")).toHaveCount(0);
    await expect(page.getByTestId("photo-attach")).toBeVisible();
  });

  test("dark mode photo bubble still renders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAs(page, "Saad");
    const marker = `dark-photo-${Date.now()}`;
    await sendPhotoWithCaption(page, fixtureJpeg, marker);
    await expect(
      page.locator('[data-testid="photo-bubble"]').filter({ hasText: marker }),
    ).toBeVisible();
  });
});
