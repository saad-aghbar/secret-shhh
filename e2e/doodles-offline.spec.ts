import { expect, test } from "@playwright/test";

import { drawHeart, openDoodleEditor, sendOpenDoodle } from "./helpers/doodles";
import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

async function countServerCopies(page: import("@playwright/test").Page, clientGeneratedId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch("/api/messages?limit=100", { credentials: "same-origin" });
    const body = (await response.json()) as { messages?: { clientGeneratedId: string }[] };
    return (body.messages ?? []).filter((message) => message.clientGeneratedId === id).length;
  }, clientGeneratedId);
}

test.describe("doodle offline", () => {
  test("queues offline and sends exactly once after reconnect", async ({ page, context }) => {
    test.setTimeout(150_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await expect(page.getByTestId("chat-experience")).toBeVisible();
    await openDoodleEditor(page);
    await page.getByTestId("doodle-close").click();
    await expect(page.getByTestId("doodle-editor")).toHaveCount(0);

    await context.setOffline(true);
    await openDoodleEditor(page);
    await drawHeart(page);
    await sendOpenDoodle(page);
    const row = page
      .locator("[data-message-id]")
      .filter({ has: page.getByTestId("doodle-bubble") })
      .last();
    await expect(row).toHaveAttribute("data-status", /queued|sending|failed/, { timeout: 15_000 });

    const clientId = await row.getAttribute("data-client-id");
    expect(clientId).toBeTruthy();
    await context.setOffline(false);
    await expect(row).toHaveAttribute("data-status", /sent|delivered|read/, { timeout: 60_000 });
    const messageId = await row.getAttribute("data-message-id");
    expect(messageId).toBeTruthy();

    await expect.poll(() => countServerCopies(page, clientId!), { timeout: 30_000 }).toBe(1);

    await page.reload();
    await scrollChatToLatest(page);
    await expect(
      page.locator(`[data-message-id="${messageId}"]`).getByTestId("doodle-bubble"),
    ).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => countServerCopies(page, clientId!)).toBe(1);
  });
});
