import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { hideDocument, openPrivacy } from "./helpers/privacy";
import { DESKTOP, loginAs } from "./helpers/media";
import { putThemeViaApi, resetThemeState } from "./helpers/theme";

const outDir = path.join(process.cwd(), "visual-qa", "privacy");

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function setMode(page: Page, mode: "light" | "dark") {
  await page.evaluate(async (value) => {
    await fetch("/api/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: value }),
    });
  }, mode);
  await page.reload();
}

async function captureSet(page: Page, prefix: string) {
  await page.goto("/more");
  await expect(page.getByTestId("privacy-entry")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("lock-screen")).toHaveCount(0);
  await page.getByTestId("quick-lock").evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await shot(page, `${prefix}-more`);
  await page.goto("/more/privacy");
  await expect(page.getByTestId("privacy-page")).toBeVisible();
  await expect(page.getByTestId("lock-screen")).toHaveCount(0);
  await shot(page, `${prefix}-privacy`);
  await page.getByTestId("quick-lock").click();
  await expect(page.getByTestId("lock-screen")).toBeVisible();
  await shot(page, `${prefix}-lock`);
  await page.getByTestId("lock-screen").getByRole("textbox", { name: "Password", exact: true }).fill("nope");
  await page.getByTestId("unlock-shhh").click();
  await expect(page.getByTestId("lock-screen").getByRole("alert")).toBeVisible();
  await shot(page, `${prefix}-wrong-password`);
  await page
    .getByTestId("lock-screen")
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(process.env.E2E_PASSWORD ?? "000000");
  await page.getByTestId("unlock-shhh").click();
  await expect(page.getByTestId("lock-screen")).toHaveCount(0, { timeout: 15_000 });
  await page.goto("/more");
  await expect(page.getByTestId("install-shhh")).toBeVisible();
  await page.getByTestId("install-shhh").scrollIntoViewIfNeeded();
  await shot(page, `${prefix}-install`);
  await page.goto("/offline");
  await expect(page.getByTestId("offline-shell")).toBeVisible();
  await shot(page, `${prefix}-offline`);
  await page.goto("/chat");
  await expect(page.getByTestId("chat-experience")).toBeVisible({ timeout: 20_000 });
  await hideDocument(page);
  await expect(page.getByTestId("privacy-cover")).toBeVisible();
  await shot(page, `${prefix}-cover`);
}

test.describe("privacy visual QA", () => {
  test.describe.configure({ retries: 1 });

  test.afterEach(async ({ page }) => {
    await resetThemeState(page).catch(() => undefined);
  });

  test("mobile light required states", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await resetThemeState(page);
    await setMode(page, "light");
    await captureSet(page, "light-390");
  });

  test("mobile dark required states", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await resetThemeState(page);
    await setMode(page, "dark");
    await captureSet(page, "dark-390");
  });

  test("custom theme privacy and lock", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await resetThemeState(page);
    await setMode(page, "light");
    const saved = await putThemeViaApi(page, "light", {
      version: 1,
      preset: "blush",
      colors: {
        accent: "#6a4c3b",
        background: "#f4e6d4",
        surface: "#fff8ef",
        button: "#6a4c3b",
      },
    });
    expect(saved.ok).toBe(true);
    await page.reload();
    await openPrivacy(page);
    await expect(page.getByTestId("lock-screen")).toHaveCount(0);
    await shot(page, "custom-390-privacy");
    await page.getByTestId("quick-lock").click();
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    await shot(page, "custom-390-lock");
  });

  test("desktop privacy, lock, install, offline", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    await resetThemeState(page);
    await setMode(page, "light");
    await captureSet(page, "desktop");
  });
});
