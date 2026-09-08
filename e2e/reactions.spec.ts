import { expect, test } from "@playwright/test";

import { chooseMessageAction, messageRow, reactWith, sendText } from "./helpers/interactions";
import { DESKTOP, loginAs, scrollChatToLatest } from "./helpers/media";

async function openTwoUsers(browser: import("@playwright/test").Browser) {
  const saadContext = await browser.newContext();
  const talaContext = await browser.newContext();
  const saad = await saadContext.newPage();
  const tala = await talaContext.newPage();
  await loginAs(saad, "Saad");
  await loginAs(tala, "Tala");
  return { saad, tala, saadContext, talaContext };
}

test.describe("reactions", () => {
  test("add, replace, and remove a reaction from the tray", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const text = `phase8 react ${Date.now()}`;
    await sendText(page, text);
    await reactWith(page, text, "❤️");
    const row = messageRow(page, text);
    await reactWith(page, text, "😂");
    await expect(row.getByTestId("reaction-summary")).toContainText("😂");
    await expect(row.getByTestId("reaction-summary")).not.toContainText("❤️");
    await chooseMessageAction(page, text, "react-clear");
    await expect(row.getByTestId("reaction-summary")).toHaveCount(0);
  });

  test("native emoji input accepts one grapheme", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const text = `phase8 any-emoji ${Date.now()}`;
    await sendText(page, text);
    await chooseMessageAction(page, text, "react-more");
    const input = page.getByTestId("reaction-emoji-input").locator("input");
    await expect(input).toBeFocused();
    await input.fill("🇵🇸");
    await expect(messageRow(page, text).getByTestId("reaction-summary")).toContainText("🇵🇸");
  });

  test("both people can react and the partner sees it without refresh", async ({ browser }) => {
    test.setTimeout(90_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    await saad.setViewportSize(DESKTOP);
    await tala.setViewportSize(DESKTOP);
    const text = `phase8 both-react ${Date.now()}`;
    await sendText(tala, text);
    await expect(saad.getByText(text)).toBeVisible({ timeout: 25_000 });
    await reactWith(saad, text, "❤️");
    await scrollChatToLatest(tala);
    await expect(messageRow(tala, text).getByTestId("reaction-summary")).toContainText("❤️", {
      timeout: 25_000,
    });

    await reactWith(tala, text, "❤️");
    await expect(messageRow(tala, text).getByTestId("reaction-summary")).toContainText("2");
    await expect(messageRow(saad, text).getByTestId("reaction-summary")).toContainText("2", {
      timeout: 25_000,
    });

    await reactWith(tala, text, "😂");
    await expect(messageRow(tala, text).getByTestId("reaction-summary")).toContainText("😂");
    await expect(messageRow(saad, text).getByTestId("reaction-summary")).toContainText("😂", {
      timeout: 25_000,
    });
    await saadContext.close();
    await talaContext.close();
  });
});
