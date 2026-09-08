import { expect, test } from "@playwright/test";

import { heartDocument, sendDoodleViaApi } from "./helpers/doodles";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("doodle search", () => {
  test("type filter finds a doodle and jumps to it", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendDoodleViaApi(page, heartDocument());

    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Doodles", exact: true }).click();
    await page.getByTestId("filters-apply").click();
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("search-result-doodle-thumb").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("search-result").first().click();
    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 15_000 });
    await expect(page.locator('[data-highlighted="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("doodle-bubble").last()).toBeVisible();
  });
});
