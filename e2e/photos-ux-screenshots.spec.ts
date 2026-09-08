import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Visual smoke screenshots for Phase 4 photo polish (light + dark, mobile).
 * Writes under test-results/photo-ux/ — review as a designer, not pixel-diff CI.
 */
const password = process.env.E2E_PASSWORD ?? "000000";
const fixtureJpeg = path.join(__dirname, "fixtures", "tiny.jpg");
const fixturePng = path.join(__dirname, "fixtures", "tiny.png");
const outDir = path.join(__dirname, "..", "test-results", "photo-ux");

async function loginAs(page: Page, name: "Saad" | "Tala") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: false,
  });
}

test.describe("photo UX visual capture", () => {
  test("light mobile: attach, selection, sent bubble, viewer", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await shot(page, "light-attach-sheet");

    await page.getByTestId("media-input").setInputFiles([fixtureJpeg, fixturePng]);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await shot(page, "light-selection-multi");

    const marker = `ux-shot-${Date.now()}`;
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    const bubble = page.locator('[data-testid="photo-bubble"]').filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 60_000 });
    await bubble.scrollIntoViewIfNeeded();
    await shot(page, "light-sent-bubble");

    await bubble.getByRole("button", { name: /Open photo/i }).first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByTestId("photo-save")).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, "light-viewer");
    await page.keyboard.press("Escape");
  });

  test("dark mobile: bubble + viewer", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAs(page, "Saad");
    const marker = `ux-dark-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    const bubble = page.locator('[data-testid="photo-bubble"]').filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 60_000 });
    await bubble.scrollIntoViewIfNeeded();
    await shot(page, "dark-sent-bubble");
    await bubble.getByRole("button", { name: /Open photo/i }).first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible();
    await expect(page.getByTestId("photo-save")).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, "dark-viewer");
  });

  test("desktop: floating attach popover near +", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "Saad");
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("attach-sheet-desktop")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
    await shot(page, "desktop-attach-float");
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await shot(page, "desktop-selection");
  });
});
