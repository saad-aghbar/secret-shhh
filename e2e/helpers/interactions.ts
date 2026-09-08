import { expect, type Page } from "@playwright/test";

import { scrollChatToLatest } from "./media";

export function messageRow(page: Page, text: string) {
  return page.locator("[data-message-id]").filter({ hasText: text }).last();
}

export async function waitUntilActionable(page: Page, text: string) {
  await scrollChatToLatest(page);
  const row = messageRow(page, text);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const id = await row.getAttribute("data-message-id");
        const client = await row.getAttribute("data-client-id");
        return Boolean(id && client && id !== client);
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return row;
}

export async function sendText(page: Page, text: string) {
  await page.keyboard.press("Escape").catch(() => undefined);
  const box = page.getByPlaceholder("Message…");
  await box.click({ force: true });
  await box.fill("");
  await box.fill(text);
  await expect(box).toHaveValue(text);
  const send = page.getByRole("button", { name: "Send", exact: true });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
  await expect(box).toHaveValue("", { timeout: 10_000 });
  await scrollChatToLatest(page);
  await waitUntilActionable(page, text);
}

export async function openMessageActions(page: Page, text: string) {
  const row = await waitUntilActionable(page, text);
  await page.keyboard.press("Escape").catch(() => undefined);
  await row.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
  await expect(page.getByTestId("action-reply")).toBeVisible({ timeout: 10_000 });
  return row;
}

export async function chooseMessageAction(page: Page, text: string, action: string) {
  const row = await openMessageActions(page, text);
  await row.evaluate((node, next) => {
    node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: next, bubbles: true }));
  }, action);
}

export async function reactWith(page: Page, text: string, emoji: string) {
  await chooseMessageAction(page, text, `react:${emoji}`);
  await expect(messageRow(page, text).getByTestId("reaction-summary")).toContainText(emoji, {
    timeout: 15_000,
  });
}

export async function swipeRowToReply(page: Page, text: string) {
  const row = await waitUntilActionable(page, text);
  const box = await row.boundingBox();
  if (!box) throw new Error("row has no box");
  const startX = box.x + 24;
  const y = box.y + box.height / 2;
  await row.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: startX,
    clientY: y,
    pointerId: 1,
    buttons: 1,
  });
  await row.dispatchEvent("pointermove", {
    pointerType: "touch",
    clientX: startX + 80,
    clientY: y,
    pointerId: 1,
    buttons: 1,
  });
  await row.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: startX + 80,
    clientY: y,
    pointerId: 1,
  });
}
