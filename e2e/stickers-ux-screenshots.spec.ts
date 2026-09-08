import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { sendText } from "./helpers/interactions";
import { DESKTOP, fixturePng, loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";
import {
  createPaintedSticker,
  createStickerViaApi,
  openStickerTray,
  stickerOutDir,
} from "./helpers/stickers";

async function shot(page: Page, name: string) {
  fs.mkdirSync(stickerOutDir, { recursive: true });
  await page.screenshot({ path: path.join(stickerOutDir, `${name}.png`), fullPage: false });
}

async function closeTray(page: Page) {
  await page.keyboard.press("Escape").catch(() => undefined);
  await expect(page.getByTestId("sticker-tray"))
    .toHaveCount(0, { timeout: 8_000 })
    .catch(() => undefined);
}

async function settleTray(page: Page, section?: "recent" | "favorites" | "mine" | "partner") {
  await expect(page.getByTestId("sticker-tray")).toBeVisible();
  const sheet = page.getByTestId("shhh-sheet");
  if ((await sheet.count()) > 0) {
    await expect(sheet).toHaveAttribute("data-state", "open");
  }
  if (section) {
    await expect(page.getByTestId(`sticker-section-${section}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.waitForTimeout(360);
  const tileImg = page.getByTestId("sticker-tile").locator("img").first();
  if ((await page.getByTestId("sticker-tile").count()) > 0) {
    await expect(tileImg)
      .toBeVisible({ timeout: 8_000 })
      .catch(() => undefined);
  }
}

async function sendCreatedSticker(page: Page, stickerId: string) {
  const sent = await page.evaluate(async (id) => {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stickerId: id, clientGeneratedId: crypto.randomUUID() }),
    });
    return response.ok;
  }, stickerId);
  expect(sent).toBe(true);
  await scrollChatToLatest(page);
  await expect(page.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 30_000 });
}

test.describe("sticker UX visual capture", () => {
  test.describe.configure({ retries: 1 });

  test("mobile light: empty, creator, sent, reaction, reply, menu", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "light" });
    await loginAs(page, "Saad");

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
    await settleTray(page, "recent");
    await shot(page, "mobile-light-tray-recent");
    await page.getByTestId("sticker-section-favorites").click();
    await settleTray(page, "favorites");
    await expect(page.getByTestId("sticker-empty")).toBeVisible();
    await shot(page, "mobile-light-tray-favorites-empty");
    await page.getByTestId("sticker-section-mine").click();
    await settleTray(page, "mine");
    await shot(page, "mobile-light-tray-mine");
    await page.getByTestId("sticker-section-partner").click();
    await settleTray(page, "partner");
    await shot(page, "mobile-light-tray-partner");

    await page.getByTestId("sticker-create").click();
    await expect(page.getByTestId("sticker-creator")).toBeVisible();
    await page.waitForTimeout(360);
    await shot(page, "mobile-light-creator-pick");
    await page.getByTestId("sticker-file").setInputFiles(fixturePng);
    await expect(page.getByTestId("sticker-name")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sticker-save")).toBeVisible();
    await page.getByTestId("sticker-workspace").scrollIntoViewIfNeeded();
    await page.getByTestId("sticker-name").fill("بحبك");
    await shot(page, "mobile-light-creator-workspace");
    await page.getByTestId("sticker-save").click();
    await expect(page.getByTestId("sticker-creator")).toHaveCount(0, { timeout: 30_000 });
    await settleTray(page, "mine");
    await shot(page, "mobile-light-tray-after-save");
    await page.getByTestId("sticker-tile").first().click();
    await closeTray(page);
    await scrollChatToLatest(page);
    await expect(page.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 30_000 });
    await shot(page, "mobile-light-sent");

    const row = page
      .locator("[data-own='true']")
      .filter({ has: page.getByTestId("sticker-bubble") })
      .last();
    await row.evaluate((node) => {
      node.dispatchEvent(
        new CustomEvent("shhh:message-action", { detail: "react:❤️", bubbles: true }),
      );
    });
    await expect(row.getByTestId("reaction-summary")).toContainText("❤️", { timeout: 15_000 });
    await shot(page, "mobile-light-reaction");
    await row.evaluate((node) => {
      node.dispatchEvent(
        new CustomEvent("shhh:message-action", { detail: "reply", bubbles: true }),
      );
    });
    await sendText(page, `sticker reply ${Date.now().toString(36)}`);
    await shot(page, "mobile-light-reply");
    await row.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await expect(page.getByTestId("message-actions")).toBeVisible();
    await shot(page, "mobile-light-menu");
  });

  test("mobile dark + desktop tray", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAs(page, "Saad");
    const darkId = await createPaintedSticker(page, `dark ${Date.now().toString(36)}`, {
      width: 512,
      height: 512,
      fill: "rgba(244, 196, 160, 0.95)",
    });
    await sendCreatedSticker(page, darkId);
    await shot(page, "mobile-dark-sent");
    await openStickerTray(page);
    await settleTray(page, "recent");
    await shot(page, "mobile-dark-tray");
    await page.getByTestId("sticker-section-mine").click();
    await settleTray(page, "mine");
    await shot(page, "mobile-dark-tray-mine");
    await closeTray(page);

    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize(DESKTOP);
    await page.goto("/chat");
    await expect(page.getByTestId("sticker-open")).toBeVisible({ timeout: 20_000 });
    await openStickerTray(page);
    await settleTray(page, "recent");
    await shot(page, "desktop-tray");
    await page.getByTestId("sticker-create").click();
    await expect(page.getByTestId("sticker-creator")).toBeVisible();
    await shot(page, "desktop-creator-pick");
    await page.getByTestId("sticker-file").setInputFiles(fixturePng);
    await expect(page.getByTestId("sticker-name")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sticker-save")).toBeVisible();
    await page.getByTestId("sticker-workspace").scrollIntoViewIfNeeded();
    await shot(page, "desktop-creator");
    await closeTray(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/chat");
    await expect(page.getByTestId("sticker-open")).toBeVisible({ timeout: 20_000 });
    await openStickerTray(page);
    await settleTray(page, "recent");
    await shot(page, "desktop-dark-tray");
  });

  test("received, unavailable, and shaped art", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await saad.emulateMedia({ colorScheme: "light" });
    await tala.emulateMedia({ colorScheme: "light" });
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const stamp = Date.now().toString(36);
    const black = await createPaintedSticker(saad, `أسود ${stamp}`, {
      width: 512,
      height: 512,
      fill: "rgba(20, 16, 12, 0.92)",
    });
    const white = await createPaintedSticker(saad, `أبيض ${stamp}`, {
      width: 512,
      height: 512,
      fill: "rgba(255, 250, 242, 0.95)",
    });
    const portrait = await createPaintedSticker(saad, "portrait-ish", {
      width: 220,
      height: 512,
      fill: "rgba(196, 92, 74, 0.92)",
      shape: "rect",
    });
    const landscape = await createPaintedSticker(saad, "landscape-ish", {
      width: 512,
      height: 220,
      fill: "rgba(90, 140, 118, 0.92)",
      shape: "rect",
    });
    const tiny = await createPaintedSticker(saad, "tiny", {
      width: 64,
      height: 64,
      fill: "rgba(212, 132, 74, 0.95)",
    });
    const arabic = await createStickerViaApi(saad, "بحبك يا تالا");

    await sendCreatedSticker(saad, black);
    await sendCreatedSticker(saad, white);
    await sendCreatedSticker(saad, portrait);
    await sendCreatedSticker(saad, landscape);
    await sendCreatedSticker(saad, tiny);
    await sendCreatedSticker(saad, arabic);
    await scrollChatToLatest(saad);
    await shot(saad, "mobile-light-art-shapes");

    await expect(tala.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 45_000 });
    await scrollChatToLatest(tala);
    await shot(tala, "mobile-light-received");

    const row = saad
      .locator("[data-own='true']")
      .filter({ has: saad.getByTestId("sticker-bubble") })
      .last();
    await expect(row).toBeVisible();
    await openStickerTray(saad);
    await saad.getByTestId("sticker-section-mine").click();
    await saad.getByTestId("sticker-delete").first().click();
    await expect(saad.getByTestId("sticker-delete-panel")).toBeVisible();
    await shot(saad, "mobile-light-library-delete");
    await saad.getByTestId("sticker-delete-confirm").click();
    await closeTray(saad);
    await expect(saad.getByTestId("sticker-bubble").last()).toBeVisible();
    await expect(saad.getByTestId("sticker-unavailable")).toHaveCount(0);
    await shot(saad, "mobile-light-chat-after-library-delete");

    await saadContext.close();
    await talaContext.close();
  });
});
