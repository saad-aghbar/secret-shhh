import { expect, test } from "@playwright/test";

import { applyThemePreset, loginAndOpenThemeEditor } from "./helpers/theme";
import { MOBILE } from "./helpers/media";

test.describe("theme system", () => {
  test("System flips between customized Light and Dark without a reload", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await applyThemePreset(page, "ocean");

    await page.goto("/more/appearance/theme/dark");
    await expect(page.getByTestId("theme-editor")).toBeVisible();
    await applyThemePreset(page, "plum");

    await page.goto("/more/appearance");
    await page.getByRole("radio", { name: "System" }).click();

    await page.emulateMedia({ colorScheme: "light" });
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--shhh-accent").trim(),
        ),
      )
      .toBe("#3d6d7e");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect
      .poll(async () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--shhh-accent").trim(),
        ),
      )
      .toBe("#c7b2e0");
  });
});
