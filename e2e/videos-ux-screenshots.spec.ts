import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  createAlbum,
  fixtureJpeg,
  loginAs,
  openMedia,
  sendPhotos,
} from "./helpers/media";
const fixtures = path.join(__dirname, "fixtures");
const landscape =
  [
    path.join(fixtures, "tiny-landscape.webm"),
    path.join(fixtures, "tiny-landscape.mp4"),
  ].find(fs.existsSync) ?? null;
const portrait =
  [
    path.join(fixtures, "tiny-portrait.webm"),
    path.join(fixtures, "tiny-portrait.mp4"),
  ].find(fs.existsSync) ?? null;
const square =
  [
    path.join(fixtures, "tiny-square.webm"),
    path.join(fixtures, "tiny-square.mp4"),
  ].find(fs.existsSync) ?? null;
const large = [
  path.join(fixtures, "local", "video-64mb.webm"),
  path.join(fixtures, "local", "video-64mb.bin"),
].find(fs.existsSync);
const outDir = path.join(__dirname, "..", "test-results", "video-ux");

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

test.describe("video UX visual capture", () => {
  test.beforeEach(() => {
    test.skip(!landscape, "Generate video fixtures first");
  });

  test("light mobile: attach, selection, sent bubble, viewer", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    fs.mkdirSync(outDir, { recursive: true });
    await page.getByRole("dialog", { name: "Add" }).screenshot({
      path: path.join(outDir, "light-attach-sheet.png"),
    });

    await page.getByTestId("media-input").setInputFiles(landscape!);
    await expect(page.getByTestId("video-selection")).toBeVisible();
    await page.getByTestId("video-caption").fill("هاي الفيديو");
    await shot(page, "light-selection");

    await page.getByTestId("video-send").click();
    const bubble = page.getByTestId("video-bubble").filter({ hasText: "هاي الفيديو" });
    await expect(bubble).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('[data-own="true"]').filter({ hasText: "هاي الفيديو" })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );
    await bubble.scrollIntoViewIfNeeded();
    await shot(page, "light-sent-bubble");

    await bubble.getByRole("button", { name: /Open video/i }).click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByTestId("video-player")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(400);
    await shot(page, "light-viewer");
    await page.getByTestId("video-play-toggle").click();
    await page.waitForTimeout(400);
    await shot(page, "light-viewer-playing");
    await page.keyboard.press("Escape");
  });

  test("light mobile: portrait and square aspects", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!portrait || !square, "Need portrait and square fixtures");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    for (const [file, name] of [
      [portrait!, "portrait"],
      [square!, "square"],
    ] as const) {
      const marker = `aspect-${name}-${Date.now()}`;
      await page.getByTestId("photo-attach").click();
      await page.getByTestId("media-input").setInputFiles(file);
      await page.getByTestId("video-caption").fill(marker);
      await page.getByTestId("video-send").click();
      const bubble = page.getByTestId("video-bubble").filter({ hasText: marker });
      await expect(bubble).toBeVisible({ timeout: 90_000 });
      await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
        "data-status",
        /sent|delivered|read/,
        { timeout: 180_000 },
      );
      await bubble.scrollIntoViewIfNeeded();
      await shot(page, `light-aspect-${name}`);
    }
  });

  test("light mobile: upload veil during a large send", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!large, "Need 64 MB fixture for upload-progress screenshots");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(large!);
    await page.getByTestId("video-send").click();
    const veil = page.getByTestId("video-upload-veil");
    await expect(veil).toBeVisible({ timeout: 20_000 });
    await veil.scrollIntoViewIfNeeded();
    await shot(page, "light-upload-veil");
    await page.getByTestId("video-upload-cancel").click();
    await expect(page.getByText("Stop sending this video?")).toBeVisible();
    await shot(page, "light-cancel-confirm");
    await page.getByTestId("video-cancel-confirm").click();
  });

  test("dark mobile: bubble + viewer", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `video-dark-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(landscape!);
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    const bubble = page.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );
    await shot(page, "dark-sent-bubble");
    await bubble.getByRole("button", { name: /Open video/i }).click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByTestId("video-player")).toBeVisible({ timeout: 20_000 });
    await shot(page, "dark-viewer");
  });

  test("desktop: picker and media videos filter", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("attach-sheet-desktop")).toBeVisible();
    await shot(page, "desktop-attach");
    await page.keyboard.press("Escape");
    await page.goto("/media?type=video");
    await expect(page.getByTestId("media-library")).toBeVisible();
    await expect(
      page.getByTestId("media-grid").or(page.getByTestId("media-empty")),
    ).toBeVisible({ timeout: 30_000 });
    await shot(page, "desktop-media-videos");
    await page.goto("/media");
    await expect(page.getByTestId("media-type-all")).toBeVisible();
    await expect(
      page.getByTestId("media-grid").or(page.getByTestId("media-empty")),
    ).toBeVisible({ timeout: 30_000 });
    await shot(page, "desktop-media-all");
  });

  test("light mobile: mixed album with a video tile", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const marker = `ux-mixed-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(landscape!);
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );
    await sendPhotos(page, fixtureJpeg, `ux-still-${Date.now()}`);
    const title = `Mixed UX ${Date.now()}`;
    await openMedia(page);
    await createAlbum(page, title, "stills and clips", 2);
    await expect(page.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(2);
    await shot(page, "light-mixed-album");
  });
});
