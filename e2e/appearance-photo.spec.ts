import { expect, test } from "@playwright/test";

import { loginAndOpenAppearance, setPhotoFromCanvas } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

test.describe("appearance photo", () => {
  test("library photo uploads and applies as a personal wallpaper", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await setPhotoFromCanvas(page, { busy: true });
    await page.getByTestId("appearance-slider-blur").fill("0.3");
    await page.getByTestId("appearance-apply").click();
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 30_000 });
    await page.goto("/chat");
    await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-type", "image");
  });

  test("iPhone-style PNG screenshot with empty MIME uploads", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await setPhotoFromCanvas(page, {
      fileName: "IMG_1234.PNG",
      mimeType: "",
    });
    await page.getByTestId("appearance-apply").click();
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 30_000 });
    await page.goto("/chat");
    await expect(page.getByTestId("wallpaper-layer")).toHaveAttribute("data-type", "image");
  });

  test("crop drag and zoom scroll the photo like a sticker", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await setPhotoFromCanvas(page, { busy: true });
    const crop = page.getByTestId("appearance-photo-crop");
    await page.getByTestId("appearance-slider-zoom").fill("2.2");
    await expect(crop.locator("img")).toHaveCSS("transform", /matrix|scale|translate/);
    const box = await crop.boundingBox();
    if (!box) throw new Error("no crop");
    await crop.dragTo(crop, {
      sourcePosition: { x: box.width * 0.75, y: box.height * 0.75 },
      targetPosition: { x: box.width * 0.2, y: box.height * 0.2 },
    });
    await expect
      .poll(async () =>
        page.locator(".shhh-wallpaper-stack-enter").evaluate((el) => {
          const style = getComputedStyle(el);
          return `${style.getPropertyValue("--shhh-wallpaper-pan-x")} ${style.getPropertyValue("--shhh-wallpaper-pan-y")}`;
        }),
      )
      .not.toBe("0.000% 0.000%");
    await expect
      .poll(async () =>
        page
          .locator(".shhh-wallpaper-stack-enter")
          .evaluate((el) => getComputedStyle(el).getPropertyValue("--shhh-wallpaper-zoom")),
      )
      .toBe("2.200");
  });
});
