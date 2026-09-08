import { expect, test } from "@playwright/test";

import { sendText } from "./helpers/interactions";
import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";
import { createStickerViaUi, openStickerTray } from "./helpers/stickers";

test.describe("private stickers", () => {
  test("create, send, receive, react, and reply", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const name = `قلب ${Date.now().toString(36)}`;
    await createStickerViaUi(saad, name);
    await saad.getByTestId("sticker-tile").first().click();
    await scrollChatToLatest(saad);
    const outgoing = saad.getByTestId("sticker-bubble").last();
    await expect(outgoing).toBeVisible({ timeout: 30_000 });
    await expect(outgoing).toHaveAttribute("data-side", "outgoing");

    await expect(tala.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 45_000 });
    await expect(tala.getByTestId("sticker-bubble").last()).toHaveAttribute("data-side", "incoming");

    const saadRow = saad.locator("[data-message-id]").filter({ has: saad.getByTestId("sticker-bubble") }).last();
    await expect
      .poll(async () => saadRow.getAttribute("data-message-id"), { timeout: 30_000 })
      .not.toBe(await saadRow.getAttribute("data-client-id"));
    const messageId = await saadRow.getAttribute("data-message-id");
    expect(messageId).toBeTruthy();

    await saadRow.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(saad.getByTestId("action-reply")).toBeVisible();
    await saad.keyboard.press("Escape");
    await saadRow.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "react:❤️", bubbles: true }));
    });
    await expect(saadRow.getByTestId("reaction-summary")).toContainText("❤️", { timeout: 15_000 });

    await saadRow.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "reply", bubbles: true }));
    });
    await sendText(saad, `reply to sticker ${Date.now().toString(36)}`);
    await expect(saad.getByTestId("reply-preview").last()).toBeVisible();

    await saadContext.close();
    await talaContext.close();
  });

  test("empty tray sections and composer button hide while typing", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await expect(page.getByTestId("sticker-open")).toBeVisible();
    await page.getByPlaceholder("Message…").fill("typing now");
    await expect(page.getByTestId("sticker-open")).toHaveCount(0);
    await page.getByPlaceholder("Message…").fill("");
    await page.evaluate(async () => {
      const library = (await (await fetch("/api/stickers", { cache: "no-store" })).json()) as {
        favorites?: Array<{ id: string }>;
      };
      await Promise.all(
        (library.favorites ?? []).map((item) =>
          fetch(`/api/stickers/${item.id}/favorite`, { method: "DELETE" }),
        ),
      );
    });
    await openStickerTray(page);
    await page.getByTestId("sticker-section-favorites").click();
    await expect(page.getByTestId("sticker-empty")).toBeVisible();
  });
});
