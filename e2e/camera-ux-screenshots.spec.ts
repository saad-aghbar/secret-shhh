import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { loginAs, MOBILE } from "./helpers/media";

const outDir = path.join(__dirname, "..", "test-results", "camera-ux");

test.use({
  permissions: ["camera", "microphone"],
});

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function openCamera(page: Page) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-pick-camera").click();
  await expect(page.getByTestId("shhh-camera")).toBeVisible();
  await expect(page.getByTestId("shhh-camera-shutter")).toBeEnabled({ timeout: 20_000 });
}

test.describe("camera UX visual capture", () => {
  test("mobile light: sheet, idle, press, recording, photo and video preview", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    await page.waitForTimeout(400);
    fs.mkdirSync(outDir, { recursive: true });
    await page.getByRole("dialog", { name: "Add" }).screenshot({
      path: path.join(outDir, "light-attach-sheet.png"),
    });

    await page.getByTestId("media-pick-camera").click();
    await expect(page.getByTestId("shhh-camera-shutter")).toBeEnabled({ timeout: 20_000 });
    await shot(page, "light-camera-idle");

    const shutter = page.getByTestId("shhh-camera-shutter");
    const box = await shutter.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await shot(page, "light-shutter-press");
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-recording", "true", {
      timeout: 5_000,
    });
    await shot(page, "light-recording");
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByTestId("video-selection")).toBeVisible({ timeout: 15_000 });
    await shot(page, "light-video-preview");
    await page.getByRole("button", { name: "Cancel video selection" }).click();

    await openCamera(page);
    await page.getByTestId("shhh-camera-shutter").click();
    await expect(page.getByTestId("photo-selection")).toBeVisible({ timeout: 15_000 });
    await shot(page, "light-photo-preview");
    await page.getByRole("button", { name: "Cancel photo selection" }).click();

    await openCamera(page);
    await page.getByTestId("shhh-camera-flip").click();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-facing", "user", {
      timeout: 10_000,
    });
    await shot(page, "light-front-camera");
    await page.getByTestId("shhh-camera-flip").click();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-facing", "environment", {
      timeout: 10_000,
    });
    await shot(page, "light-back-camera");
  });

  test("mobile dark: same critical states", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    await page.waitForTimeout(400);
    fs.mkdirSync(outDir, { recursive: true });
    await page.getByRole("dialog", { name: "Add" }).screenshot({
      path: path.join(outDir, "dark-attach-sheet.png"),
    });

    await page.getByTestId("media-pick-camera").click();
    await expect(page.getByTestId("shhh-camera-shutter")).toBeEnabled({ timeout: 20_000 });
    await shot(page, "dark-camera-idle");

    const shutter = page.getByTestId("shhh-camera-shutter");
    const box = await shutter.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId("shhh-camera")).toHaveAttribute("data-recording", "true", {
      timeout: 5_000,
    });
    await shot(page, "dark-recording");
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByTestId("video-selection")).toBeVisible({ timeout: 15_000 });
    await shot(page, "dark-video-preview");
    await page.getByRole("button", { name: "Cancel video selection" }).click();

    await openCamera(page);
    await page.getByTestId("shhh-camera-shutter").click();
    await expect(page.getByTestId("photo-selection")).toBeVisible({ timeout: 15_000 });
    await shot(page, "dark-photo-preview");
  });

  test("desktop compact attach panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("attach-sheet-desktop")).toBeVisible();
    await shot(page, "desktop-attach");
  });
});
