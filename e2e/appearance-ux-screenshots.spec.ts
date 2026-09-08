import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  loginAndOpenAppearance,
  openAppearance,
  selectAppearanceMode,
  setPhotoFromCanvas,
} from "./helpers/appearance";
import { DESKTOP, MOBILE } from "./helpers/media";

const outDir = path.join(process.cwd(), "visual-qa", "appearance");

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function scrollPreview(page: Page) {
  await page.getByTestId("appearance-preview").scrollIntoViewIfNeeded();
}

async function captureEditorStates(page: Page, prefix: string) {
  await expect(page.getByTestId("appearance-page")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `${prefix}-home`);
  await selectAppearanceMode(page, "Personal");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `${prefix}-personal`);
  await selectAppearanceMode(page, "Shared");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `${prefix}-shared`);
  await selectAppearanceMode(page, "Personal");
  await shot(page, `${prefix}-presets`);
  await page.getByTestId("appearance-preset-sage").click();
  await expect(page.getByTestId("appearance-color-picker")).toBeVisible();
  await scrollPreview(page);
  await shot(page, `${prefix}-color-picker`);
  await page.getByTestId("appearance-preset-sage-mist").click();
  await expect(page.getByTestId("appearance-gradient-editor")).toBeVisible();
  await scrollPreview(page);
  await shot(page, `${prefix}-gradient-editor`);
  await setPhotoFromCanvas(page, { busy: true });
  await scrollPreview(page);
  await shot(page, `${prefix}-photo-picker`);
  await page.getByTestId("appearance-photo-crop").scrollIntoViewIfNeeded();
  await shot(page, `${prefix}-crop`);
  await scrollPreview(page);
  await page.getByTestId("appearance-slider-blur").fill("0.45");
  await shot(page, `${prefix}-blur`);
  await page.getByTestId("appearance-slider-dim").fill("0.35");
  await shot(page, `${prefix}-dim`);
  await page.getByTestId("appearance-slider-overlay").fill("0.4");
  await scrollPreview(page);
  await shot(page, `${prefix}-overlay`);
  await shot(page, `${prefix}-busy-photo-preview`);
  await selectAppearanceMode(page, "Shared");
  await page.getByTestId("appearance-preset-blush").click();
  await page.getByTestId("appearance-apply").click();
  await expect(page.getByTestId("shhh-modal")).toBeVisible();
  await shot(page, `${prefix}-shared-confirmation`);
  await page.getByTestId("appearance-shared-confirm").click();
  await expect(page.getByTestId("shhh-modal")).toHaveCount(0, { timeout: 20_000 });
  await page.goto("/chat");
  await expect(page.getByTestId("wallpaper-layer")).toBeVisible();
  await shot(page, `${prefix}-final-chat`);
}

test.describe("appearance visual QA", () => {
  test.describe.configure({ retries: 1 });

  test("mobile light required states", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenAppearance(page, "Saad");
    await captureEditorStates(page, "mobile-light");
  });

  test("mobile dark and desktop", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAndOpenAppearance(page, "Saad");
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await captureEditorStates(page, "mobile-dark");

    await page.setViewportSize(DESKTOP);
    await openAppearance(page);
    await shot(page, "desktop-home");
    await page.getByTestId("appearance-preset-blush").click();
    await shot(page, "desktop-color");
    await page.goto("/chat");
    await shot(page, "desktop-chat");
  });

  test("chat readability over busy, white, and black photos", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    for (const spec of [
      { name: "busy", paint: { busy: true } as const },
      { name: "near-white", paint: { nearWhite: true } as const },
      { name: "near-black", paint: { nearBlack: true } as const },
    ]) {
      await setPhotoFromCanvas(page, spec.paint);
      await page.getByTestId("appearance-apply").click();
      await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 30_000 });
      await page.goto("/chat");
      await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-type", "image");
      await shot(page, `mobile-chat-${spec.name}`);
      await page.goto("/more/appearance");
      await expect(page.getByTestId("appearance-page")).toBeVisible({ timeout: 20_000 });
    }
  });
});
