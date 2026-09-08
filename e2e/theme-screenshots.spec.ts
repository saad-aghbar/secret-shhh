import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  applyPersonalColor,
  applySharedColor,
  loginAndOpenAppearance,
  openAppearance,
  resetAppearanceState,
} from "./helpers/appearance";
import { openDoodleEditor } from "./helpers/doodles";
import { sendText } from "./helpers/interactions";
import { DESKTOP, MOBILE, fixtureJpeg } from "./helpers/media";
import { openStickerTray } from "./helpers/stickers";
import {
  EXTREME_LIGHT_THEME,
  applyThemePreset,
  loginAndOpenThemeEditor,
  openThemeEditor,
  putThemeViaApi,
} from "./helpers/theme";

const outDir = path.join(process.cwd(), "visual-qa", "theme");

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function captureSurfaces(page: Page, prefix: string) {
  await page.goto("/chat");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await shot(page, `${prefix}-chat`);
  await page.goto("/media");
  await expect(page.getByTestId("media-library")).toBeVisible();
  await shot(page, `${prefix}-media`);
  await page.goto("/search");
  await page.waitForTimeout(300);
  await shot(page, `${prefix}-search`);
  await page.goto("/more");
  await expect(page.getByTestId("appearance-entry")).toBeVisible();
  await shot(page, `${prefix}-more`);
  await page.goto("/more/appearance");
  await expect(page.getByTestId("appearance-page")).toBeVisible();
  await shot(page, `${prefix}-appearance`);
}

async function captureOverlays(page: Page, prefix: string) {
  await page.goto("/chat");
  await expect(page.getByPlaceholder("Message…")).toBeVisible();
  await page.getByTestId("photo-attach").click();
  const attach = page.getByTestId("shhh-sheet").or(page.getByTestId("attach-sheet-desktop"));
  await expect(attach).toBeVisible();
  await shot(page, `${prefix}-attach-sheet`);
  await page.keyboard.press("Escape");

  await openStickerTray(page);
  await shot(page, `${prefix}-sticker-tray`);
  await page.keyboard.press("Escape");

  await openDoodleEditor(page);
  await shot(page, `${prefix}-doodle-editor`);
  await page.getByTestId("doodle-close").click();
  if (await page.getByTestId("doodle-discard-confirm").isVisible().catch(() => false)) {
    await page.getByTestId("doodle-discard-confirm").click();
  }

  await page.getByTestId("voice-start").click();
  await expect(page.getByTestId("voice-recording")).toBeVisible({ timeout: 10_000 });
  await shot(page, `${prefix}-voice`);
  await page.getByTestId("voice-cancel").click();
}

test.describe("theme visual QA", () => {
  test.describe.configure({ retries: 1 });

  test("mobile custom Light and Dark", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await expect(page.getByTestId("theme-app-preview")).toBeVisible();
    await shot(page, "mobile-editor-light");
    await applyThemePreset(page, "blush");
    await page.goto("/more/appearance");
    await page.getByRole("radio", { name: "Light" }).click();
    await captureSurfaces(page, "mobile-light-blush");
    await captureOverlays(page, "mobile-light-blush");

    const unique = `theme react ${Date.now().toString(36)}`;
    await sendText(page, unique);
    const row = page.locator("[data-message-id]").filter({ hasText: unique }).last();
    await row.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(page.getByTestId("action-reply")).toBeVisible({ timeout: 10_000 });
    await shot(page, "mobile-light-blush-reaction-sheet");
    await page.keyboard.press("Escape");

    await page.goto("/more/appearance");
    await openThemeEditor(page, "dark");
    await shot(page, "mobile-editor-dark");
    await applyThemePreset(page, "plum");
    await page.goto("/more/appearance");
    await page.getByRole("radio", { name: "Dark" }).click();
    await captureSurfaces(page, "mobile-dark-plum");
    await captureOverlays(page, "mobile-dark-plum");
  });

  test("desktop custom Light", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await shot(page, "desktop-editor-light");
    await applyThemePreset(page, "ocean");
    await page.goto("/more/appearance");
    await page.getByRole("radio", { name: "Light" }).click();
    await captureSurfaces(page, "desktop-light-ocean");
    await captureOverlays(page, "desktop-light-ocean");
  });

  test("wallpapers and extreme readability", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenAppearance(page, "Saad");
    await resetAppearanceState(page);
    const blush = await putThemeViaApi(page, "light", {
      version: 1,
      preset: "blush",
      colors: {},
    });
    expect(blush.ok).toBe(true);
    await page.reload();
    await page.getByRole("radio", { name: "Light" }).click();

    await page.goto("/chat");
    await shot(page, "mobile-light-blush-wallpaper-default");

    await openAppearance(page, { reset: false });
    await applyPersonalColor(page, "sage");
    await page.goto("/chat");
    await shot(page, "mobile-light-blush-wallpaper-personal");

    await openAppearance(page, { reset: false });
    await applySharedColor(page, "clay");
    await page.goto("/chat");
    await shot(page, "mobile-light-blush-wallpaper-shared");

    const extreme = await putThemeViaApi(page, "light", EXTREME_LIGHT_THEME);
    expect(extreme.ok).toBe(true);
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--shhh-outgoing-text").trim(),
        ),
      )
      .toBe("#2a2622");
    await shot(page, "mobile-light-extreme");

    await page.goto("/media");
    const tile = page.getByTestId("media-thumb").first();
    if (await tile.isVisible().catch(() => false)) {
      await tile.click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 15_000 });
      await shot(page, "mobile-light-extreme-photo-viewer");
      await page.keyboard.press("Escape");
    } else {
      await page.goto("/chat");
      await page.getByTestId("photo-attach").click();
      await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
      await expect(page.getByTestId("photo-selection")).toBeVisible();
      await page.getByTestId("photo-caption").fill("theme viewer");
      await page.getByTestId("photo-send").click();
      await expect(page.getByText("theme viewer").first()).toBeVisible({ timeout: 60_000 });
      await page
        .locator('[data-testid="photo-bubble"]')
        .filter({ hasText: "theme viewer" })
        .first()
        .click();
      await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
      await shot(page, "mobile-light-extreme-photo-viewer");
    }
  });
});
