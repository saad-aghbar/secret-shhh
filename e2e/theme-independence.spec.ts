import { expect, test } from "@playwright/test";

import { applyThemePreset, loginAndOpenThemeEditor, openThemeEditor } from "./helpers/theme";
import { openAppearance } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

test.describe("theme independence", () => {
  test("Light and Dark stay independent across reload", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await applyThemePreset(page, "blush");

    await page.goto("/more/appearance");
    await expect(page.getByTestId("theme-entries")).toBeVisible();
    await openThemeEditor(page, "dark");
    await applyThemePreset(page, "midnight");

    await page.reload();
    await expect(page.getByTestId("theme-editor")).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--shhh-accent").trim(),
        ),
      )
      .not.toBe("");

    await page.goto("/more/appearance");
    await openAppearance(page, { reset: false });
    await expect(page.getByTestId("theme-entry-light")).toContainText("Your colors");
    await expect(page.getByTestId("theme-entry-dark")).toContainText("Your colors");
  });
});
