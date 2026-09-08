import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { loginAs, MOBILE } from "./helpers/media";

const fixtureJpeg = path.join(__dirname, "fixtures", "tiny.jpg");
const fixtureVideo = [
  path.join(__dirname, "fixtures", "tiny-landscape.webm"),
  path.join(__dirname, "fixtures", "tiny-landscape.mp4"),
].find((file) => fs.existsSync(file));

test.use({
  permissions: ["camera", "microphone"],
});

async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) return;
    const original = media.getUserMedia.bind(media);
    const streams: MediaStream[] = [];
    (window as unknown as { __shhhStreams: MediaStream[] }).__shhhStreams = streams;
    media.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
}

async function openCamera(page: Page) {
  await page.getByTestId("photo-attach").click();
  await expect(page.getByTestId("media-pick-camera")).toBeVisible();
  await page.getByTestId("media-pick-camera").click();
  await expect(page.getByTestId("shhh-camera")).toBeVisible();
  await expect(page.getByTestId("shhh-camera-shutter")).toBeEnabled({ timeout: 20_000 });
}

test.describe("camera media entry", () => {
  test("attachment sheet shows Media + Camera and drops the old tiles", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    await expect(page.getByText("Choose photos or videos")).toBeVisible();
    await expect(page.getByText("Tap for photo · Hold for video")).toBeVisible();
    await expect(page.getByTestId("photo-pick-library")).toHaveCount(0);
    await expect(page.getByTestId("video-pick-library")).toHaveCount(0);
    await expect(page.getByTestId("photo-pick-camera")).toHaveCount(0);
    await expect(page.getByTestId("video-pick-record")).toHaveCount(0);
    await expect(page.getByTestId("media-input")).toHaveAttribute("accept", "image/*,video/*");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test("media picker routes an image into the photo pipeline", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    const marker = `cam-photo-lib-${Date.now()}`;
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    await expect(page.getByTestId("photo-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("media picker routes a video into the video pipeline", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!fixtureVideo, "Need a tiny video fixture");
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureVideo!);
    await expect(page.getByTestId("video-selection")).toBeVisible();
    const marker = `cam-video-lib-${Date.now()}`;
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    await expect(page.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 90_000,
    });
  });

  test("mixed pick hands photos then video sequentially", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!fixtureVideo, "Need a tiny video fixture");
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles([fixtureJpeg, fixtureVideo!]);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await expect(page.getByText("Videos send one at a time — 1 more after this.")).toBeVisible();
    const photoMarker = `mixed-photo-${Date.now()}`;
    await page.getByTestId("photo-caption").fill(photoMarker);
    await page.getByTestId("photo-send").click();
    await expect(page.getByTestId("video-selection")).toBeVisible();
    const videoMarker = `mixed-video-${Date.now()}`;
    await page.getByTestId("video-caption").fill(videoMarker);
    await page.getByTestId("video-send").click();
    await expect(page.getByTestId("photo-bubble").filter({ hasText: photoMarker })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("video-bubble").filter({ hasText: videoMarker })).toBeVisible({
      timeout: 90_000,
    });
  });

  test("denied camera permission uses consumer copy", async ({ page }) => {
    await page.addInitScript(() => {
      const media = navigator.mediaDevices;
      if (!media) return;
      media.getUserMedia = () =>
        Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-pick-camera").click();
    await expect(page.getByTestId("shhh-camera")).toBeVisible();
    await expect(page.getByTestId("shhh-camera-denied")).toBeVisible();
    await expect(page.getByText("Camera access is off.")).toBeVisible();
    await expect(page.getByText(/getUserMedia|NotAllowedError|MediaStream/)).toHaveCount(0);
  });

  test("tap shutter creates a photo preview and send works", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openCamera(page);
    await page.getByTestId("shhh-camera-shutter").click();
    await expect(page.getByTestId("photo-selection")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("photo-retake")).toBeVisible();
    const marker = `cam-tap-${Date.now()}`;
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    await expect(page.getByTestId("photo-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("hold shutter records video; release shows video preview", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openCamera(page);
    const shutter = page.getByTestId("shhh-camera-shutter");
    const box = await shutter.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-recording", "true", {
      timeout: 5_000,
    });
    await expect(page.getByTestId("shhh-camera-timer")).toBeVisible();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(page.getByTestId("video-selection")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("video-preview-play")).toBeVisible();
    await expect(page.getByTestId("video-retake")).toBeVisible();
    const previewErrors: string[] = [];
    page.on("pageerror", (error) => previewErrors.push(error.message));
    await page.getByTestId("video-preview-play").click();
    expect(
      previewErrors.filter((text) => /NotSupportedError|unhandledRejection/i.test(text)),
    ).toEqual([]);
    const marker = `cam-hold-${Date.now()}`;
    await page.getByTestId("video-caption").fill(marker);
    await page.getByTestId("video-send").click();
    await expect(page.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 90_000,
    });
  });

  test("cancelled hold does not send", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openCamera(page);
    const shutter = page.getByTestId("shhh-camera-shutter");
    const box = await shutter.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 40, box!.y + box!.height / 2 + 8);
    await page.mouse.up();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-recording", "false");
    await expect(page.getByTestId("photo-selection")).toHaveCount(0);
    await expect(page.getByTestId("video-selection")).toHaveCount(0);
    await expect(page.getByTestId("shhh-camera")).toBeVisible();
  });

  test("front/back switch updates facing and close ends tracks", async ({ page }) => {
    await trackStreams(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openCamera(page);
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-facing", "environment");
    await page.getByTestId("shhh-camera-flip").click();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-facing", "user", {
      timeout: 10_000,
    });
    await page.getByTestId("shhh-camera-close").click();
    await expect(page.getByTestId("shhh-camera")).toHaveCount(0);
    const ended = await page.evaluate(() => {
      const streams = (window as unknown as { __shhhStreams?: MediaStream[] }).__shhhStreams ?? [];
      return (
        streams.length > 0 &&
        streams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))
      );
    });
    expect(ended).toBe(true);
  });

  test("reduced motion still captures a photo", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openCamera(page);
    await page.getByTestId("shhh-camera-shutter").click();
    await expect(page.getByTestId("photo-selection")).toBeVisible({ timeout: 15_000 });
  });
});
