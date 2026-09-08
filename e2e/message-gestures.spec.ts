import { expect, test } from "@playwright/test";

import { messageRow, sendText, swipeRowToReply } from "./helpers/interactions";
import { loginAs, MOBILE } from "./helpers/media";

test.use({
  viewport: MOBILE,
  hasTouch: true,
});

test.describe("message gestures", () => {
  test("swipe right opens a reply on both sides", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "Saad");
    const text = `phase8 swipe ${Date.now()}`;
    await sendText(page, text);
    await swipeRowToReply(page, text);
    await expect(page.getByTestId("composer-reply")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("composer-reply")).toContainText(text);
  });

  test("vertical movement does not reply", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "Saad");
    const text = `phase8 scroll ${Date.now()}`;
    await sendText(page, text);
    const row = messageRow(page, text);
    const box = await row.boundingBox();
    if (!box) throw new Error("row has no box");
    await row.dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: box.x + 20,
      clientY: box.y + 10,
      pointerId: 1,
      buttons: 1,
    });
    await row.dispatchEvent("pointermove", {
      pointerType: "touch",
      clientX: box.x + 22,
      clientY: box.y + 80,
      pointerId: 1,
      buttons: 1,
    });
    await row.dispatchEvent("pointerup", {
      pointerType: "touch",
      clientX: box.x + 22,
      clientY: box.y + 80,
      pointerId: 1,
    });
    await expect(page.getByTestId("composer-reply")).toHaveCount(0);
  });
});
