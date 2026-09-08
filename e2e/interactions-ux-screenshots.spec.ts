import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import {
  chooseMessageAction,
  messageRow,
  openMessageActions,
  reactWith,
  sendText,
} from "./helpers/interactions";
import { DESKTOP, loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

const outDir = path.join(__dirname, "..", "visual-qa", "interactions");

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

test.describe("interactions UX visual capture", () => {
  test.describe.configure({ retries: 1 });

  test("mobile light: reply, tray, edit, tombstone", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const original = `phase8 shot original ${stamp}`;
    const reply = `phase8 shot reply ${stamp}`;
    const arabic = `بحبك ${stamp}`;
    await sendText(page, original);
    await sendText(page, arabic);
    await openMessageActions(page, original);
    const panel = page.getByTestId("shhh-popover");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("reaction-tray")).toBeVisible();
    await expect(panel.getByTestId("message-actions")).toBeVisible();
    await expect(panel.getByTestId("action-reply")).toBeVisible();
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        return box
          ? box.y >= 0 && box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390
          : false;
      })
      .toBe(true);
    await shot(page, "light-mobile-actions");
    await chooseMessageAction(page, original, "reply");
    await expect(page.getByTestId("composer-reply")).toBeVisible();
    await shot(page, "light-mobile-composer-reply");
    await noHorizontalOverflow(page);
    await sendText(page, reply);
    await scrollChatToLatest(page);
    await shot(page, "light-mobile-reply-thread");

    await chooseMessageAction(page, reply, "react");
    await expect(page.getByTestId("reaction-tray").last()).toBeVisible();
    await shot(page, "light-mobile-reaction-tray");
    await reactWith(page, reply, "❤️");
    await shot(page, "light-mobile-reaction-summary");

    await chooseMessageAction(page, reply, "edit");
    await expect(page.getByTestId("composer-edit")).toBeVisible();
    await expect(page.getByTestId("action-reply")).toHaveCount(0);
    await expect(page.getByTestId("reaction-tray")).toHaveCount(0);
    await shot(page, "light-mobile-composer-edit");
    await page.getByTestId("composer-context-close").click();

    await chooseMessageAction(page, reply, "delete");
    await expect(page.getByRole("heading", { name: "Delete message?" })).toBeVisible();
    await expect(page.getByTestId("action-reply")).toHaveCount(0);
    await expect(page.getByTestId("delete-confirm")).toBeVisible();
    await shot(page, "light-mobile-delete-confirm");
    await chooseMessageAction(page, reply, "delete-now");
    await expect(page.getByTestId("message-tombstone").last()).toBeVisible();
    await shot(page, "light-mobile-tombstone");
    await noHorizontalOverflow(page);
  });

  test("mobile dark: reply, tray, tombstone", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAs(page, "Tala");
    const stamp = Date.now();
    const original = `phase8 dark original ${stamp}`;
    const reply = `phase8 dark reply ${stamp}`;
    await sendText(page, original);
    await chooseMessageAction(page, original, "reply");
    await sendText(page, reply);
    await reactWith(page, reply, "🥺");
    await shot(page, "dark-mobile-reply-react");
    await chooseMessageAction(page, reply, "delete");
    await chooseMessageAction(page, reply, "delete-now");
    await expect(page.getByTestId("message-tombstone").last()).toBeVisible();
    await shot(page, "dark-mobile-tombstone");
    await noHorizontalOverflow(page);
  });

  test("desktop: hover menu, popover, grouped thread", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAs(page, "Saad");
    const stamp = Date.now();
    await sendText(page, `phase8 desk one ${stamp}`);
    await sendText(page, `phase8 desk two ${stamp}`);
    const last = `phase8 desk three ${stamp}`;
    await sendText(page, last);
    await messageRow(page, last).hover();
    await shot(page, "desktop-hover-more");
    await openMessageActions(page, last);
    const deskPanel = page.getByTestId("shhh-popover");
    await expect(deskPanel).toBeVisible();
    await expect(deskPanel.getByTestId("reaction-tray")).toBeVisible();
    await expect(deskPanel.getByTestId("message-actions")).toBeVisible();
    await shot(page, "desktop-action-popover");
    await chooseMessageAction(page, last, "reply");
    await sendText(page, `phase8 desk reply ${stamp}`);
    await shot(page, "desktop-reply-thread");
  });
});
