import { expect, test } from "@playwright/test";

import { chooseMessageAction, messageRow, sendText } from "./helpers/interactions";
import { DESKTOP, loginAs, scrollChatToLatest } from "./helpers/media";

test.describe("edit and delete", () => {
  test("edits own text, marks it edited, and makes the new words searchable", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const before = `phase8helo${stamp}`;
    const after = `phase8hello${stamp}`;
    await sendText(page, before);
    await chooseMessageAction(page, before, "edit");
    await expect(page.getByTestId("composer-edit")).toBeVisible();
    await expect(page.getByTestId("photo-attach")).toHaveCount(0);
    await page.getByPlaceholder("Message…").fill(after);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("composer-edit")).toHaveCount(0);
    await scrollChatToLatest(page);
    await expect(messageRow(page, after)).toBeVisible();
    await expect(messageRow(page, after).getByTestId("edited-indicator")).toBeVisible();
    await expect(page.getByTestId("mutation-error")).toHaveCount(0);

    await expect
      .poll(async () => {
        return page.evaluate(async (query) => {
          const response = await fetch(`/api/search/messages?q=${encodeURIComponent(query)}&tz=UTC`);
          const body = (await response.json()) as { results?: Array<{ snippet?: string; textContent?: string }> };
          return (body.results ?? []).some((item) =>
            `${item.snippet ?? ""} ${item.textContent ?? ""}`.includes(query),
          );
        }, after);
      }, { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(async () => {
        return page.evaluate(async (query) => {
          const response = await fetch(`/api/search/messages?q=${encodeURIComponent(query)}&tz=UTC`);
          const body = (await response.json()) as { results?: Array<{ snippet?: string; textContent?: string }> };
          return (body.results ?? []).some((item) =>
            `${item.snippet ?? ""} ${item.textContent ?? ""}`.includes(query),
          );
        }, before);
      }, { timeout: 10_000 })
      .toBe(false);
  });

  test("delete leaves a tombstone and hides the text from search", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const text = `phase8 delete me ${stamp}`;
    await sendText(page, text);
    await chooseMessageAction(page, text, "delete");
    await expect(page.getByTestId("delete-confirm")).toBeVisible();
    await chooseMessageAction(page, text, "delete-now");
    await scrollChatToLatest(page);
    await expect(page.getByTestId("message-tombstone").last()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(text)).toHaveCount(0);

    await page.goto(`/search?q=${encodeURIComponent(text)}`);
    await expect(page.getByTestId("search-result").filter({ hasText: text })).toHaveCount(0);

    await page.goto("/search?tab=history");
    const today = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
    await page.locator(`[data-testid="history-day"][data-date="${today}"]`).click();
    await expect(page.getByTestId("history-day-messages")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("history-day-message").filter({ hasText: "Message deleted" }).last()).toBeVisible();
  });

  test("partner sees an edit and a tombstone without refresh", async ({ browser }) => {
    test.setTimeout(120_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(DESKTOP);
    await tala.setViewportSize(DESKTOP);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");
    const stamp = Date.now();
    const before = `phase8 live helo ${stamp}`;
    const after = `phase8 live hello ${stamp}`;
    await sendText(saad, before);
    await expect(tala.getByText(before)).toBeVisible({ timeout: 25_000 });
    await chooseMessageAction(saad, before, "edit");
    await saad.getByPlaceholder("Message…").fill(after);
    await saad.getByRole("button", { name: "Save", exact: true }).click();
    await expect(tala.getByText(after)).toBeVisible({ timeout: 25_000 });

    const gone = `phase8 live delete ${stamp}`;
    await sendText(saad, gone);
    await expect(tala.getByText(gone)).toBeVisible({ timeout: 25_000 });
    await chooseMessageAction(saad, gone, "delete");
    await expect(saad.getByTestId("delete-confirm")).toBeVisible();
    await chooseMessageAction(saad, gone, "delete-now");
    await expect(saad.getByTestId("message-tombstone").last()).toBeVisible({ timeout: 15_000 });
    await expect(tala.getByTestId("message-tombstone").last()).toBeVisible({ timeout: 25_000 });
    await saadContext.close();
    await talaContext.close();
  });
});
