import { expect, test } from "@playwright/test";

import { chooseMessageAction, messageRow, sendText } from "./helpers/interactions";
import { DESKTOP, fixtureJpeg, loginAs, sendPhotos } from "./helpers/media";

test.describe("message replies", () => {
  test("reply to text, jump to original, and show a search reply chip", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const original = `phase8 original ${stamp}`;
    const reply = `phase8 reply ${stamp}`;
    await sendText(page, original);
    await chooseMessageAction(page, original, "reply");
    await expect(page.getByTestId("composer-reply")).toBeVisible();
    await sendText(page, reply);

    const replyRow = messageRow(page, reply);
    await expect(replyRow.getByTestId("reply-preview")).toBeVisible();
    await expect(replyRow.getByTestId("reply-preview")).toContainText(original);

    await replyRow.getByTestId("reply-preview").click();
    await expect(page.locator("[data-highlighted='true']").filter({ hasText: original })).toBeVisible({
      timeout: 10_000,
    });

    await page.goto(`/search?q=${encodeURIComponent(reply)}`);
    await expect(page.getByTestId("search-result").filter({ hasText: reply })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("search-reply")).toBeVisible();
  });

  test("reply to a photo keeps the caption in the preview", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const caption = `phase8 photo orig ${stamp}`;
    const reply = `phase8 photo reply ${stamp}`;
    await sendPhotos(page, fixtureJpeg, caption);
    await chooseMessageAction(page, caption, "reply");
    await sendText(page, reply);
    await expect(messageRow(page, reply).getByTestId("reply-preview")).toContainText(caption);
  });

  test("Arabic reply keeps LTR chrome and auto body direction", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const original = `اشتقتلك ${stamp}`;
    const reply = `وأنا كمان ${stamp}`;
    await sendText(page, original);
    await chooseMessageAction(page, original, "reply");
    await sendText(page, reply);
    const preview = messageRow(page, reply).getByTestId("reply-preview");
    await expect(preview).toBeVisible();
    await expect(preview.locator("[dir='auto']")).toBeVisible();
  });

  test("partner receives a reply in realtime", async ({ browser }) => {
    test.setTimeout(90_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(DESKTOP);
    await tala.setViewportSize(DESKTOP);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");
    const stamp = Date.now();
    const original = `phase8 live original ${stamp}`;
    const reply = `phase8 live reply ${stamp}`;
    await sendText(tala, original);
    await expect(saad.getByText(original)).toBeVisible({ timeout: 25_000 });
    await chooseMessageAction(saad, original, "reply");
    await sendText(saad, reply);
    await expect(tala.getByText(reply)).toBeVisible({ timeout: 25_000 });
    await expect(tala.locator("[data-message-id]").filter({ hasText: reply }).getByTestId("reply-preview")).toBeVisible();
    await saadContext.close();
    await talaContext.close();
  });
});
