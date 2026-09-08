import { expect, test } from "@playwright/test";

import { loginAndOpenAppearance } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

test.describe("appearance offline", () => {
  test("keeps a draft after leaving and coming back", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await page.getByTestId("appearance-preset-blush").click();
    await expect(page.getByTestId("appearance-apply")).toBeEnabled();
    await page.goto("/more");
    await page.getByTestId("appearance-entry").click();
    await expect(page.getByTestId("appearance-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("appearance-preset-blush")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("appearance-apply")).toBeEnabled();
  });
});
