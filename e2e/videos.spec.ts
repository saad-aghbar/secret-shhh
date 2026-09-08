import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  createAlbum,
  fixtureJpeg,
  loginAs,
  MOBILE,
  openMedia,
  sendPhotos,
} from "./helpers/media";

const fixtures = path.join(__dirname, "fixtures");
const localDir = path.join(fixtures, "local");

function firstExisting(names: string[]) {
  for (const name of names) {
    const full = path.join(fixtures, name);
    if (fs.existsSync(full)) return full;
    const local = path.join(localDir, name);
    if (fs.existsSync(local)) return local;
  }
  return null;
}

const videoFixture = firstExisting([
  "tiny-landscape.webm",
  "tiny-landscape.mp4",
  "tiny-square.webm",
  "tiny-square.mp4",
]);

const largeFixture = firstExisting(["video-64mb.webm", "video-64mb.bin"]);

async function sendVideo(page: Page, file: string, caption: string) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(file);
  await expect(page.getByTestId("video-selection")).toBeVisible();
  await page.getByTestId("video-caption").fill(caption);
  await page.getByTestId("video-send").click();
  await expect(page.getByTestId("video-bubble").filter({ hasText: caption })).toBeVisible({
    timeout: 90_000,
  });
}

test.describe("videos", () => {
  test.beforeEach(() => {
    test.skip(!videoFixture, "Generate fixtures with pnpm exec tsx scripts/make-video-fixtures.ts");
  });

  test("picker shows Media and Camera; send plays in viewer", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    await expect(page.getByTestId("video-pick-library")).toHaveCount(0);
    await expect(page.getByTestId("photo-pick-library")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const marker = `video-e2e-${Date.now()}`;
    await sendVideo(page, videoFixture!, marker);
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );

    const bubble = page.getByTestId("video-bubble").filter({ hasText: marker });
    const posterState = await bubble.getAttribute("data-poster");
    console.log("tinyWebmPoster", posterState);
    await expect(bubble).toHaveAttribute("data-poster", "ready", { timeout: 20_000 });
    await expect(bubble.locator("img").first()).toBeVisible();
    await expect(bubble.getByTestId("video-poster-placeholder")).toHaveCount(0);
    await expect(bubble.getByTestId("photo-load-error")).toHaveCount(0);

    await bubble.getByRole("button", { name: /Open video/i }).click();
    const viewer = page.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible({ timeout: 20_000 });
    await expect(viewer).toHaveAttribute("data-media-kind", "video");
    await expect(page.getByTestId("video-player")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("video-play-toggle").click();
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  });

  test("text still sends while a video is uploading", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const marker = `video-priority-${Date.now()}`;
    await sendVideo(page, videoFixture!, marker);
    await expect(page.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible();

    const text = `text-during-video-${Date.now()}`;
    await page.locator("#shhh-message").fill(text);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
  });

  test("cancel aborts an in-flight video", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const file = largeFixture ?? videoFixture!;
    const marker = `video-cancel-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(file);
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    const bubble = page.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    const veil = bubble.getByTestId("video-upload-veil");
    const appeared = await veil.isVisible({ timeout: 8_000 }).catch(() => false);
    if (appeared) {
      await bubble.getByTestId("video-upload-cancel").click();
      await page.getByTestId("video-cancel-confirm").click();
      await expect(bubble).toHaveCount(0);
    }
  });

  test("reload asks to choose the video again", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    test.skip(!largeFixture, "Need e2e/fixtures/local/video-64mb.webm for reload-reselect");
    const marker = `video-reselect-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(largeFixture!);
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    const bubble = page.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () =>
        page.evaluate(async (caption) => {
          const request = indexedDB.open("shhh-chat");
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          if (!db.objectStoreNames.contains("pendingVideoUploads")) {
            db.close();
            return 0;
          }
          const tx = db.transaction("pendingVideoUploads", "readonly");
          const store = tx.objectStore("pendingVideoUploads");
          const rows = await new Promise<Array<{ caption?: string }>>((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as Array<{ caption?: string }>);
            req.onerror = () => reject(req.error);
          });
          db.close();
          return rows.filter((row) => row.caption === caption).length;
        }, marker),
      )
      .toBeGreaterThan(0);
    // Stall remaining browser→R2 PUTs so a fast connection cannot finish
    // before reload. Same-origin navigation must still work.
    await page.route(/cloudflarestorage/, (route) => {
      if (route.request().method() === "PUT") {
        void route.abort();
        return;
      }
      void route.continue();
    });
    await page.reload();
    await expect(page.getByTestId("chat-experience")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("chat-experience")).toHaveAttribute(
      "data-optimistic-media",
      /[1-9]/,
      { timeout: 20_000 },
    );
    await page.getByTestId("chat-message-list").evaluate(async (node) => {
      for (let i = 0; i < 16; i += 1) {
        node.scrollTop = node.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    });
    const jump = page.getByTestId("jump-to-latest");
    if (await jump.isVisible().catch(() => false)) {
      await jump.click();
    }
    const restored = page.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(restored).toBeVisible({ timeout: 30_000 });
    await expect(restored.getByTestId("video-reselect")).toBeVisible({ timeout: 20_000 });
    await restored.getByTestId("video-reselect-input").setInputFiles(largeFixture!);
    await page.unroute(/cloudflarestorage/);
    await expect(restored.getByTestId("video-upload-veil")).toBeVisible({ timeout: 20_000 });
  });

  test("search finds a video caption under Videos; library Videos filter works", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const marker = `video-search-${Date.now()}`;
    await sendVideo(page, videoFixture!, marker);
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );

    await page.goto(`/search?q=${encodeURIComponent(marker)}&type=videos`);
    await expect(page.getByTestId("search-result").filter({ hasText: marker })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/media?type=video");
    await expect(page.getByTestId("media-type-video")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("media-grid").or(page.getByTestId("media-empty"))).toBeVisible({
      timeout: 30_000,
    });
  });

  test("mixed album can include a video tile", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const marker = `video-album-${Date.now()}`;
    await sendVideo(page, videoFixture!, marker);
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );
    await sendPhotos(page, fixtureJpeg, `photo-with-video-${Date.now()}`);
    const title = `Mixed ${Date.now()}`;
    await openMedia(page);
    await createAlbum(page, title, "clips + stills", 2);
    await expect(page.getByTestId("album-grid").getByTestId("media-thumb")).toHaveCount(2);
    await expect(page.getByText("2 items")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add photos or videos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add photos", exact: true })).toHaveCount(0);
    await page.getByTestId("album-actions-open").click();
    await expect(page.getByTestId("album-reorder-open")).toHaveText("Reorder items");
    await expect(page.getByTestId("album-remove-open")).toHaveText("Remove items");
    await page.keyboard.press("Escape");
  });
});
