import { expect, test } from "@playwright/test";

import {
  applyPersonalColor,
  applySharedColor,
  openAppearance,
} from "./helpers/appearance";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("appearance reset", () => {
  test("personal reset falls through to shared", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Tala");
    await openAppearance(page);
    await applySharedColor(page, "clay");

    await loginAs(page, "Saad");
    await openAppearance(page, { reset: false });
    await applyPersonalColor(page, "sage");
    const resetDone = page.waitForResponse(
      (response) =>
        response.url().includes("/api/appearance/personal") && response.request().method() === "DELETE",
    );
    await page.getByTestId("appearance-reset").click();
    await resetDone;
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
    await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-source", "shared");
    await page.goto("/chat");
    await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-source", "shared", {
      timeout: 20_000,
    });
  });
});
