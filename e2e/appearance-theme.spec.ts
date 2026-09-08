import { expect, test } from "@playwright/test";

import { applyPersonalColor, loginAndOpenAppearance } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

test.describe("appearance theme", () => {
  test("theme toggle still lives in Appearance and wallpaper survives it", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await applyPersonalColor(page, "sage");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("appearance-preview")).toBeVisible();
    await page.getByRole("radio", { name: "Light" }).click();
    await page.goto("/chat");
    await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-type", "solid");
  });
});
