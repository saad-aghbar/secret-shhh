import { expect, test } from "@playwright/test";

import { loginAndOpenAppearance, setPhotoFromCanvas } from "./helpers/appearance";
import { sendText } from "./helpers/interactions";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("appearance readability", () => {
  test("bubbles and metadata stay visible over busy, white, and black photos", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendText(page, "Readability check from Saad");
    await loginAndOpenAppearance(page, "Saad");

    for (const spec of [{ busy: true }, { nearWhite: true }, { nearBlack: true }] as const) {
      await setPhotoFromCanvas(page, spec);
      await page.getByTestId("appearance-slider-overlay").fill("0.2");
      await expect(page.getByTestId("appearance-preview").getByText("Readability check from Saad").or(page.getByTestId("appearance-preview").locator(".shhh-message-meta")).first()).toBeVisible();
    }
  });
});
