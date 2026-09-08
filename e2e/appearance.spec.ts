import { expect, test } from "@playwright/test";

import {
  applyPersonalColor,
  loginAndOpenAppearance,
  openAppearance,
  wallpaperSource,
  wallpaperType,
} from "./helpers/appearance";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("appearance", () => {
  test("More opens Appearance and a personal color applies to Chat", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await expect(page.getByTestId("appearance-preview")).toBeVisible();
    await expect(page.getByText("Only you see this")).toBeVisible();
    await applyPersonalColor(page, "sage");
    await page.goto("/chat");
    await expect(page.getByTestId("wallpaper-layer")).toBeVisible();
    expect(await wallpaperType(page)).toBe("solid");
    expect(await wallpaperSource(page)).toBe("personal");
    await page.goto("/search");
    await expect(page.getByTestId("wallpaper-layer")).toHaveCount(0);
  });

  test("Default preset stays an active personal override", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Tala");
    await openAppearance(page);
    await page.getByTestId("appearance-mode").getByRole("radio", { name: "Shared" }).click();
    await page.getByTestId("appearance-preset-clay").click();
    await page.getByTestId("appearance-apply").click();
    await page.getByTestId("appearance-shared-confirm").click();
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
    await page.goto("/chat");
    expect(await wallpaperSource(page)).toBe("shared");

    await loginAs(page, "Saad");
    await page.evaluate(async () => {
      window.localStorage.removeItem("shhh.appearance.draft");
      await fetch("/api/appearance/personal", { method: "DELETE" });
    });
    await openAppearance(page, { reset: false });
    await page.getByTestId("appearance-mode").getByRole("radio", { name: "Personal" }).click();
    await page.getByTestId("appearance-preset-default").click();
    await expect(page.getByTestId("appearance-apply")).toBeEnabled();
    await page.getByTestId("appearance-apply").click();
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
    await page.goto("/chat");
    expect(await wallpaperSource(page)).toBe("personal");
    expect(await wallpaperType(page)).toBe("none");
  });

  test("dim and readability washes update live in the preview", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await page.getByTestId("appearance-preset-sage").click();
    const preview = page.getByTestId("appearance-preview");
    const dim = preview.locator(".shhh-wallpaper-stack-enter [data-testid='wallpaper-dim']");
    const overlay = preview.locator(".shhh-wallpaper-stack-enter [data-testid='wallpaper-overlay']");
    await expect(dim).toHaveCount(1);

    await page.getByTestId("appearance-slider-dim").fill("0.85");
    await expect
      .poll(async () => dim.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toMatch(/rgba\(\s*0,\s*0,\s*0,\s*0\.85/);

    await page.getByTestId("appearance-slider-overlay").fill("0.7");
    await expect
      .poll(async () => overlay.evaluate((el) => Number(getComputedStyle(el).opacity)))
      .toBeCloseTo(0.7, 1);
  });
});
