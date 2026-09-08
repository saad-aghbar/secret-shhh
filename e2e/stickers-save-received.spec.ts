import { expect, test } from "@playwright/test";

import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";
import { createStickerViaApi } from "./helpers/stickers";

test.describe("save a received sticker", () => {
  test("partner can save and unsave without deleting the definition", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const name = `save-me ${Date.now().toString(36)}`;
    const stickerId = await createStickerViaApi(saad, name);
    const sent = await saad.evaluate(async (id) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stickerId: id, clientGeneratedId: crypto.randomUUID() }),
      });
      return response.ok;
    }, stickerId);
    expect(sent).toBe(true);
    await scrollChatToLatest(saad);
    await expect(saad.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 30_000 });

    const incoming = tala.locator("[data-own='false']").filter({ has: tala.getByTestId("sticker-bubble") }).last();
    await expect(incoming).toBeVisible({ timeout: 45_000 });
    await incoming.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(tala.getByTestId("action-save-sticker")).toBeVisible({ timeout: 10_000 });
    await incoming.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "save-sticker", bubbles: true }));
    });
    await tala.keyboard.press("Escape").catch(() => undefined);

    await incoming.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(tala.getByTestId("action-unsave-sticker")).toBeVisible({ timeout: 15_000 });
    await expect(tala.getByTestId("action-delete-sticker")).toHaveCount(0);

    await saadContext.close();
    await talaContext.close();
  });
});
