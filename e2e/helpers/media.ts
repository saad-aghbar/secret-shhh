import { expect, type Page } from "@playwright/test";
import path from "node:path";

export const password = process.env.E2E_PASSWORD ?? "000000";
export const fixtureDir = path.join(__dirname, "..", "fixtures");
export const fixtureJpeg = path.join(fixtureDir, "tiny.jpg");
export const fixturePng = path.join(fixtureDir, "tiny.png");

export const MOBILE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

export async function loginAs(page: Page, name: "Saad" | "Tala") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });
  await endLeftoverCall(page);
  await scrollChatToLatest(page);
}

/** Suite isolation: a leftover live call hydrates CallSession and can stall later media. */
export async function endLeftoverCall(page: Page) {
  await page
    .evaluate(async () => {
      const response = await fetch("/api/calls", { credentials: "same-origin" });
      if (!response.ok) return;
      const body = (await response.json()) as { call?: { id: string } | null };
      if (!body.call?.id) return;
      await fetch(`/api/calls/${body.call.id}/end`, { method: "POST", credentials: "same-origin" });
    })
    .catch(() => undefined);
}

/** Newest bubbles are virtualized; jump/scroll so a caption at the end is in the DOM. */
export async function scrollChatToLatest(page: Page) {
  const chat = page.getByTestId("chat-experience");
  if (!(await chat.isVisible().catch(() => false))) return;
  const jump = page.getByTestId("jump-to-latest");
  if (await jump.isVisible().catch(() => false)) {
    await jump.click().catch(() => undefined);
  }
  await page
    .getByTestId("chat-message-list")
    .evaluate(async (node) => {
      for (let i = 0; i < 16; i += 1) {
        node.scrollTop = node.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    })
    .catch(() => undefined);
}

export async function sendPhotos(page: Page, files: string | string[], caption: string) {
  await page.goto("/chat");
  await endLeftoverCall(page);
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(files);
  await expect(page.getByTestId("photo-selection")).toBeVisible();
  await page.getByTestId("photo-caption").fill(caption);
  await page.getByTestId("photo-send").click();
  await revealLatestCaption(page, caption, 60_000);
  // The bubble appears optimistically. The library only lists finalized media,
  // so wait for the upload to land before a test goes looking for it there.
  // Keep the newest row mounted — a large virtualized thread can unmount it.
  const row = page.locator('[data-own="true"]').filter({ hasText: caption }).first();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await scrollChatToLatest(page);
    const status = await row.getAttribute("data-status").catch(() => null);
    if (status && /sent|delivered|read/.test(status)) return;
    await page.waitForTimeout(400);
  }
  await expect(row).toHaveAttribute("data-status", /sent|delivered|read/, { timeout: 1_000 });
}

export async function openMedia(page: Page, query = "") {
  await page.goto(`/media${query}`);
  await expect(page.getByTestId("media-library")).toBeVisible({ timeout: 30_000 });
}

export async function revealLatestCaption(page: Page, caption: string, timeout = 90_000) {
  await expect(page.getByTestId("chat-experience")).toBeVisible({ timeout: 20_000 });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await scrollChatToLatest(page);
    if (
      await page
        .getByText(caption)
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    await page.waitForTimeout(500);
  }
  await expect(page.getByText(caption).first()).toBeVisible({ timeout: 1_000 });
}

/** Waits for the grid rather than a spinner, so skeleton timing can't flake. */
export async function waitForGrid(page: Page) {
  await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 30_000 });
  await expect(gridThumbs(page).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Tiles in the main grid only. "Loved by both" renders the same photos above it,
 * so an unscoped `media-thumb` would hand back a favorite instead of the newest.
 */
export function gridThumbs(page: Page) {
  return page.getByTestId("media-grid").getByTestId("media-thumb");
}

const NEXT_OVERLAY_RE =
  /hydrat|cannot be a descendant|cannot contain a nested|Minified React error|unhandledRejection/i;

/**
 * Subscribe before the first navigation. Next.js prints hydration and invalid
 * HTML as `pageerror` plus console.error — both must be empty for a clean load.
 */
export function watchNextJsErrors(page: Page) {
  const overlay: string[] = [];
  const ignore =
    /Download the React DevTools|Fast Refresh|favicon|net::ERR_ABORTED|ResizeObserver loop/i;

  page.on("pageerror", (error) => {
    if (NEXT_OVERLAY_RE.test(error.message) && !ignore.test(error.message)) {
      overlay.push(error.message);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ignore.test(text)) return;
    if (NEXT_OVERLAY_RE.test(text)) overlay.push(text);
  });

  return {
    overlay,
    assertNoOverlay() {
      expect(overlay, overlay.join("\n\n")).toEqual([]);
    },
  };
}

export async function createAlbum(page: Page, title: string, note: string, photoCount: number) {
  await page.getByTestId("media-mode-albums").click();
  await expect(page.getByTestId("albums-home")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("album-create-open").first().click();

  await page.getByTestId("album-title-input").fill(title);
  if (note) await page.getByTestId("album-note-input").fill(note);
  await page.getByTestId("album-create-continue").click();

  const tiles = page.getByTestId("media-select-tile");
  await expect(tiles.first()).toBeVisible({ timeout: 30_000 });
  for (let index = 0; index < photoCount; index += 1) {
    await tiles.nth(index).click();
  }
  await page.getByTestId("album-create-submit").click();
  await expect(page.getByTestId("album-detail")).toBeVisible({ timeout: 30_000 });
}
