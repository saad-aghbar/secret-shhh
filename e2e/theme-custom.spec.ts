import { expect, test } from "@playwright/test";

import { applyThemePreset, cssVar, loginAndOpenThemeEditor } from "./helpers/theme";
import { sendText } from "./helpers/interactions";
import { MOBILE } from "./helpers/media";

test.describe("theme custom", () => {
  test("custom Light applies across Chat, Media, Music, Search, and More", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await applyThemePreset(page, "blush");
    await page.goto("/more/appearance");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    expect(await cssVar(page, "--shhh-accent")).toBe("#b56d5c");
    expect(await cssVar(page, "--shhh-bg")).toBe("#f6efe8");
    expect(await cssVar(page, "--shhh-outgoing")).toBe("#ead4cc");
    expect(await cssVar(page, "--shhh-incoming")).toBe("#fffdf9");
    expect(await cssVar(page, "--shhh-composer")).toBe("#fffdf9");
    expect(await cssVar(page, "--shhh-sheet")).toBe("#fffdf9");
    expect(await cssVar(page, "--shhh-button")).toBe("#b56d5c");
    expect(await cssVar(page, "--shhh-nav-selected")).toBe("#b56d5c");

    await page.goto("/chat");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect
      .poll(async () => cssVar(page, "--shhh-nav-selected"))
      .toBe("#b56d5c");

    const composer = page.locator("form").locator(".bg-composer");
    await expect(composer).toBeVisible();
    const composerBg = await composer.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(composerBg).toBe("rgb(255, 253, 249)");

    const unique = `theme blush ${Date.now().toString(36)}`;
    await sendText(page, unique);
    const bubble = page
      .locator("[data-own='true']")
      .filter({ hasText: unique })
      .locator(".bg-outgoing-bubble")
      .first();
    await expect(bubble).toBeVisible();
    const bubbleColor = await bubble.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(bubbleColor).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByTestId("photo-attach").click();
    const sheet = page.getByTestId("shhh-sheet");
    await expect(sheet).toBeVisible();
    const sheetPanel = sheet.locator(".shhh-sheet-panel");
    await expect(sheetPanel).toBeVisible();
    const sheetBg = await sheetPanel.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(sheetBg).toBe("rgb(255, 253, 249)");
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("Message…").fill("go");
    const send = page.locator("form").getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeVisible();
    await expect(send).toHaveClass(/bg-button/);
    expect(await cssVar(page, "--shhh-button")).toBe("#b56d5c");

    await page.goto("/media");
    await expect(page.getByTestId("media-library")).toBeVisible();
    await expect.poll(async () => cssVar(page, "--shhh-bg")).toBe("#f6efe8");

    await page.goto("/music");
    await expect(page.getByTestId("music-home")).toBeVisible();
    await expect.poll(async () => cssVar(page, "--shhh-accent")).toBe("#b56d5c");

    await page.goto("/more/search");
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect.poll(async () => cssVar(page, "--shhh-accent")).toBe("#b56d5c");

    await page.goto("/more");
    await expect(page.getByTestId("appearance-entry")).toBeVisible();
    await page.getByTestId("appearance-entry").click();
    await expect(page.getByTestId("theme-entry-light")).toContainText("Your colors");
  });
});
