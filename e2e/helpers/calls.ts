import { expect, type Browser, type Page } from "@playwright/test";

import { endLeftoverCall, loginAs, scrollChatToLatest } from "./media";

export async function endAnyCall(page: Page) {
  await endLeftoverCall(page);
}

export async function openTwoUsers(browser: Browser) {
  const saadContext = await browser.newContext();
  const talaContext = await browser.newContext();
  const saad = await saadContext.newPage();
  const tala = await talaContext.newPage();
  await loginAs(saad, "Saad");
  await loginAs(tala, "Tala");
  await endAnyCall(saad);
  await endAnyCall(tala);
  return { saad, tala, saadContext, talaContext };
}

export async function startCall(page: Page, type: "audio" | "video") {
  await expect(page.getByTestId("call-surface")).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined);
  await endAnyCall(page);
  const button = page.getByTestId(type === "video" ? "start-video-call" : "start-audio-call");
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
  await expect(page.getByTestId("call-surface")).toBeVisible({ timeout: 15_000 });
}

export async function waitForIncoming(page: Page) {
  await expect(page.getByTestId("incoming-call")).toBeVisible({ timeout: 20_000 });
}

export async function applyCallPreview(
  page: Page,
  state: Record<string, unknown> | null,
) {
  await page.evaluate((next) => {
    window.__shhhCallPreview?.(next as never);
  }, state);
}

export async function expectCallHistory(page: Page, title: string) {
  await page.goto("/chat");
  await scrollChatToLatest(page);
  await expect(page.getByTestId("call-event-row").filter({ hasText: title }).first()).toBeVisible({
    timeout: 20_000,
  });
}
