import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { sendText } from "./helpers/interactions";
import {
  almostEmptyDocument,
  blackDocument,
  denseDocument,
  doodleOutDir,
  drawHeart,
  drawStroke,
  heartDocument,
  mixedToolDocument,
  openDoodleEditor,
  paleDocument,
  sendDoodleViaApi,
  sendOpenDoodle,
  thickDocument,
  thinDocument,
  whiteDocument,
} from "./helpers/doodles";
import { DESKTOP, loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

async function shot(page: Page, name: string) {
  fs.mkdirSync(doodleOutDir, { recursive: true });
  await page.screenshot({ path: path.join(doodleOutDir, `${name}.png`), fullPage: false });
}

function lastDoodleRow(page: Page) {
  return page.locator("[data-message-id]").filter({ has: page.getByTestId("doodle-bubble") }).last();
}

async function closeEditorIfOpen(page: Page) {
  const editor = page.getByTestId("doodle-editor");
  if ((await editor.count()) === 0) return;
  await page.getByTestId("doodle-close").click();
  if (await page.getByTestId("doodle-discard").isVisible().catch(() => false)) {
    await page.getByTestId("doodle-discard-confirm").click();
  }
  await expect(editor).toHaveCount(0, { timeout: 10_000 });
}

test.describe("doodle visual QA", () => {
  test.describe.configure({ retries: 1 });

  test("mobile light: 14 required states", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAs(page, "Saad");

    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-doodle")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add" })).toBeVisible();
    await page.waitForTimeout(200);
    await shot(page, "mobile-light-attach");
    await page.getByTestId("media-pick-doodle").click();
    await expect(page.getByTestId("doodle-editor")).toBeVisible({ timeout: 15_000 });

    await shot(page, "mobile-light-empty");
    await page.getByTestId("doodle-tool-pen").click();
    await expect(page.getByTestId("doodle-stroke-options")).toBeVisible();
    await shot(page, "mobile-light-pen");
    await shot(page, "mobile-light-thickness");
    await page.getByTestId("doodle-tool-marker").click();
    await shot(page, "mobile-light-marker");
    await page.getByTestId("doodle-tool-eraser").click();
    await shot(page, "mobile-light-eraser");
    await page.getByTestId("doodle-tool-pen").click();
    await page.getByTestId("doodle-color").click();
    await expect(page.getByTestId("doodle-palette")).toBeVisible();
    await shot(page, "mobile-light-palette");
    await page.getByTestId("doodle-swatch-coral").click();
    await drawHeart(page);
    await shot(page, "mobile-light-drawing");
    await shot(page, "mobile-light-finished");
    await page.getByTestId("doodle-close").click();
    await expect(page.getByTestId("doodle-discard")).toBeVisible();
    await shot(page, "mobile-light-discard");
    await page.getByTestId("doodle-discard-keep").click();
    await sendOpenDoodle(page);
    await shot(page, "mobile-light-sent");

    await loginAs(page, "Tala");
    await sendDoodleViaApi(page, heartDocument("#6b8fad"));
    await loginAs(page, "Saad");
    await scrollChatToLatest(page);
    await expect(page.getByTestId("doodle-bubble").last()).toBeVisible();
    await shot(page, "mobile-light-received");

    const incoming = lastDoodleRow(page);
    await incoming.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "react:❤️", bubbles: true }));
    });
    await expect(incoming.getByTestId("reaction-summary")).toContainText("❤️", { timeout: 15_000 });
    await shot(page, "mobile-light-reaction");
    await incoming.evaluate((node) => {
      node.dispatchEvent(new CustomEvent("shhh:message-action", { detail: "reply", bubbles: true }));
    });
    await sendText(page, "love this doodle");
    await shot(page, "mobile-light-reply");
    await page.getByTestId("doodle-bubble").last().click();
    await expect(page.getByTestId("doodle-viewer")).toBeVisible();
    await page.waitForTimeout(250);
    await shot(page, "mobile-light-viewer");
    await page.getByTestId("doodle-viewer-close").click();
  });

  test("mobile dark + desktop set", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAs(page, "Saad");
    await openDoodleEditor(page);
    await drawStroke(page, { x: 0.25, y: 0.3 }, { x: 0.7, y: 0.55 });
    await shot(page, "mobile-dark-editor");
    await page.getByTestId("doodle-color").click();
    await expect(page.getByTestId("doodle-palette")).toBeVisible();
    await shot(page, "mobile-dark-palette");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("doodle-palette")).toHaveCount(0);
    await sendOpenDoodle(page);
    await shot(page, "mobile-dark-sent");
    await page.getByTestId("doodle-bubble").last().click();
    await expect(page.getByTestId("doodle-viewer")).toBeVisible();
    await shot(page, "mobile-dark-viewer");
    await page.getByTestId("doodle-viewer-close").click();

    await loginAs(page, "Tala");
    await sendDoodleViaApi(page, mixedToolDocument());
    await loginAs(page, "Saad");
    await page.emulateMedia({ colorScheme: "dark" });
    await scrollChatToLatest(page);
    await shot(page, "mobile-dark-received");

    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: "light" });
    await openDoodleEditor(page);
    await shot(page, "desktop-light-editor");
    await drawStroke(page, { x: 0.2, y: 0.25 }, { x: 0.75, y: 0.7 });
    await shot(page, "desktop-light-drawing");
    await page.getByTestId("doodle-tool-pen").click();
    await expect(page.getByTestId("doodle-stroke-options")).toBeVisible();
    await shot(page, "desktop-light-options");
    await page.getByTestId("doodle-color").click();
    await expect(page.getByTestId("doodle-palette")).toBeVisible();
    await shot(page, "desktop-light-palette");
    await page.keyboard.press("Escape");
    await closeEditorIfOpen(page);
    await sendDoodleViaApi(page, heartDocument("#4a756c"));
    await scrollChatToLatest(page);
    await shot(page, "desktop-light-chat");
    const desktopRow = lastDoodleRow(page);
    await desktopRow.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(page.getByTestId("action-reply")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("action-edit")).toHaveCount(0);
    await shot(page, "desktop-light-context");
    await page.keyboard.press("Escape");
    await page.mouse.click(24, 120);
    await page.getByTestId("doodle-bubble").last().click();
    await expect(page.getByTestId("doodle-viewer")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(250);
    await shot(page, "desktop-light-viewer");
    await page.getByTestId("doodle-viewer-close").click();

    await page.emulateMedia({ colorScheme: "dark" });
    await openDoodleEditor(page);
    await shot(page, "desktop-dark-editor");
    await closeEditorIfOpen(page);
    await scrollChatToLatest(page);
    await shot(page, "desktop-dark-chat");
  });

  test("visual edge cases", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAs(page, "Saad");

    await sendText(page, "text before doodles");
    await sendDoodleViaApi(page, almostEmptyDocument());
    await shot(page, "edge-almost-empty");
    await sendDoodleViaApi(page, blackDocument());
    await shot(page, "edge-black");
    await sendDoodleViaApi(page, whiteDocument());
    await shot(page, "edge-white");
    await sendDoodleViaApi(page, paleDocument());
    await shot(page, "edge-pale");
    await sendDoodleViaApi(page, thinDocument());
    await shot(page, "edge-thin");
    await sendDoodleViaApi(page, thickDocument());
    await shot(page, "edge-thick");
    await sendDoodleViaApi(page, mixedToolDocument());
    await shot(page, "edge-marker-layering");
    await sendDoodleViaApi(page, denseDocument());
    await shot(page, "edge-dense");
    await sendDoodleViaApi(page, heartDocument("#d9899c"));
    await sendDoodleViaApi(page, heartDocument("#4a756c"));
    await sendDoodleViaApi(page, heartDocument("#9b8ab8"));
    await sendText(page, "text after doodles");
    await scrollChatToLatest(page);
    await shot(page, "edge-sequential-and-text");

    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Doodles", exact: true }).click();
    await page.getByTestId("filters-apply").click();
    await expect(page.getByTestId("search-result-doodle-thumb").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("doodle-art").first()).toBeVisible({ timeout: 15_000 });
    await shot(page, "mobile-light-search");
  });
});
