import { expect, test } from "@playwright/test";

import { chooseMessageAction, messageRow, reactWith, sendText } from "./helpers/interactions";
import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

test.describe("interaction scroll stability", () => {
  test("react, edit, and delete do not remount the bubble or jump the list", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    await sendText(page, `phase8 stable older ${stamp}`);
    const text = `phase8 stable ${stamp}`;
    await sendText(page, text);
    await scrollChatToLatest(page);

    const row = messageRow(page, text);
    const clientId = await row.getAttribute("data-client-id");
    expect(clientId).toBeTruthy();
    const list = page.getByTestId("chat-message-list");
    const before = await list.evaluate((el) => el.scrollTop);

    await reactWith(page, text, "❤️");
    await expect(row.getByTestId("reaction-summary")).toBeVisible();
    await expect(row).toHaveAttribute("data-client-id", clientId!);

    await chooseMessageAction(page, text, "edit");
    const edited = `${text} edited`;
    await page.getByPlaceholder("Message…").fill(edited);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(messageRow(page, edited)).toHaveAttribute("data-client-id", clientId!);

    const after = await list.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(80);
  });
});
