import { expect, test } from "@playwright/test";

import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";
import { createStickerViaApi, openStickerTray } from "./helpers/stickers";

test.describe("delete sticker from library", () => {
  test("tray delete hides the tile and keeps already-sent chat art", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const stickerId = await createStickerViaApi(saad, `delete-me ${Date.now().toString(36)}`);
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
    const row = saad
      .locator("[data-own='true']")
      .filter({ has: saad.getByTestId("sticker-bubble") })
      .last();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(tala.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 45_000 });

    await row.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(saad.getByTestId("action-delete-sticker")).toHaveCount(0);
    await saad.keyboard.press("Escape").catch(() => undefined);

    await openStickerTray(saad);
    await saad.getByTestId("sticker-section-mine").click();
    await saad.locator(`[data-testid="sticker-delete"][data-sticker-id="${stickerId}"]`).click();
    await expect(saad.getByTestId("sticker-delete-panel")).toBeVisible();
    const archived = saad.waitForResponse(
      (response) =>
        response.url().includes(`/api/stickers/${stickerId}`) &&
        response.request().method() === "DELETE",
    );
    await saad.getByTestId("sticker-delete-confirm").click();
    expect((await archived).ok()).toBe(true);
    await expect(
      saad.locator(`[data-testid="sticker-tile"][data-sticker-id="${stickerId}"]`),
    ).toHaveCount(0, { timeout: 15_000 });

    await saad.getByTestId("sticker-section-recent").click();
    await expect(
      saad.locator(`[data-testid="sticker-tile"][data-sticker-id="${stickerId}"]`),
    ).toHaveCount(0);
    await saad.keyboard.press("Escape").catch(() => undefined);
    await expect(saad.getByTestId("sticker-bubble").last()).toBeVisible();
    await expect(saad.getByTestId("sticker-unavailable")).toHaveCount(0);
    await expect(tala.getByTestId("sticker-bubble").last()).toBeVisible();
    await expect(tala.getByTestId("sticker-unavailable")).toHaveCount(0);

    const resent = await saad.evaluate(async (id) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stickerId: id, clientGeneratedId: crypto.randomUUID() }),
      });
      return response.status;
    }, stickerId);
    expect(resent).toBeGreaterThanOrEqual(400);

    await saadContext.close();
    await talaContext.close();
  });
});
