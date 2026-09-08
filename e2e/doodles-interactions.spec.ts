import { expect, test } from "@playwright/test";

import { sendText } from "./helpers/interactions";
import { heartDocument, sendDoodleViaApi } from "./helpers/doodles";
import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

test.describe("doodle interactions", () => {
  test("reply, react, jump, and delete follow Phase 8", async ({ browser }) => {
    test.setTimeout(240_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    await sendDoodleViaApi(saad, heartDocument());
    await expect(tala.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 45_000 });

    const saadRow = saad
      .locator("[data-message-id]")
      .filter({ has: saad.getByTestId("doodle-bubble") })
      .last();
    await expect
      .poll(async () => saadRow.getAttribute("data-message-id"), { timeout: 30_000 })
      .not.toBe(await saadRow.getAttribute("data-client-id"));

    await saadRow.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(saad.getByTestId("action-reply")).toBeVisible();
    await expect(saad.getByTestId("action-edit")).toHaveCount(0);
    await saad.keyboard.press("Escape");

    await saadRow.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "react:❤️", bubbles: true }));
    });
    await expect(saadRow.getByTestId("reaction-summary")).toContainText("❤️", { timeout: 15_000 });

    await saadRow.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "reply", bubbles: true }));
    });
    await sendText(saad, `reply to doodle ${Date.now().toString(36)}`);
    await expect(saad.getByTestId("reply-preview").last()).toBeVisible();
    await saad.getByTestId("reply-preview").last().click();
    await expect(saad.locator('[data-highlighted="true"]')).toBeVisible({ timeout: 15_000 });

    await saadRow.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "delete-now", bubbles: true }));
    });
    await expect(saad.getByTestId("message-tombstone").last()).toBeVisible({ timeout: 15_000 });

    await scrollChatToLatest(tala);
    await saadContext.close();
    await talaContext.close();
  });
});
