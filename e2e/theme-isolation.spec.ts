import { expect, test } from "@playwright/test";

import { applyThemePreset, loginAndOpenThemeEditor } from "./helpers/theme";
import { loginAndOpenAppearance } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

test.describe("theme isolation", () => {
  test("Tala does not inherit Saad's Light theme", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenThemeEditor(page, "Saad", "light");
    await applyThemePreset(page, "peach");

    await loginAndOpenAppearance(page, "Tala");
    await expect(page.getByTestId("theme-entry-light")).toContainText("Shhh original");
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--shhh-accent").trim(),
    );
    expect(accent).toBe("#4a756c");
  });
});
