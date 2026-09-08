import { expect, test } from "@playwright/test";

import { drawStroke, openDoodleEditor } from "./helpers/doodles";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("doodle cancel", () => {
  test("empty close is immediate; ink asks to keep or discard", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await openDoodleEditor(page);
    await page.getByTestId("doodle-close").click();
    await expect(page.getByTestId("doodle-editor")).toHaveCount(0);

    await openDoodleEditor(page);
    await drawStroke(page, { x: 0.3, y: 0.4 }, { x: 0.7, y: 0.45 });
    await page.getByTestId("doodle-close").click();
    await expect(page.getByTestId("doodle-discard")).toBeVisible();
    await page.getByTestId("doodle-discard-keep").click();
    await expect(page.getByTestId("doodle-editor")).toBeVisible();
    await expect(page.getByTestId("doodle-send")).toBeEnabled();
    await page.getByTestId("doodle-close").click();
    await page.getByTestId("doodle-discard-confirm").click();
    await expect(page.getByTestId("doodle-editor")).toHaveCount(0);
  });
});
