import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { fixturePng, scrollChatToLatest } from "./media";

export async function openStickerTray(page: Page) {
  await page.getByTestId("sticker-open").click();
  await expect(page.getByTestId("sticker-tray")).toBeVisible({ timeout: 15_000 });
}

export async function createStickerViaUi(page: Page, name: string, file = fixturePng) {
  await openStickerTray(page);
  await page.getByTestId("sticker-create").click();
  await expect(page.getByTestId("sticker-creator")).toBeVisible();
  await page.getByTestId("sticker-file").setInputFiles(file);
  await expect(page.getByTestId("sticker-name")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("sticker-save")).toBeVisible();
  await page.getByTestId("sticker-workspace").scrollIntoViewIfNeeded();
  await page.getByTestId("sticker-name").fill(name);
  await page.getByTestId("sticker-save").click();
  await expect(page.getByTestId("sticker-creator")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("sticker-tile").first()).toBeVisible({ timeout: 20_000 });
}

export async function createStickerViaApi(
  page: Page,
  name: string,
  file = fixturePng,
  size = { width: 512, height: 512 },
) {
  const bytes = fs.readFileSync(file);
  const id = await page.evaluate(
    async ({ name: stickerName, bytesList, size: dims }) => {
      const form = new FormData();
      const id = crypto.randomUUID();
      form.set("id", id);
      form.set("file", new Blob([new Uint8Array(bytesList)], { type: "image/png" }), "sticker.png");
      form.set("name", stickerName);
      form.set("animated", "false");
      form.set("width", String(dims.width));
      form.set("height", String(dims.height));
      const response = await fetch("/api/stickers", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error((await response.text()) || "create failed");
      }
      return id;
    },
    { name, bytesList: Array.from(bytes), size },
  );
  return id;
}

export async function createPaintedSticker(
  page: Page,
  name: string,
  paint: { width: number; height: number; fill: string; shape?: "circle" | "rect" },
) {
  return page.evaluate(async ({ name: stickerName, paint: spec }) => {
    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("no canvas");
    ctx.clearRect(0, 0, spec.width, spec.height);
    ctx.fillStyle = spec.fill;
    if (spec.shape === "rect") {
      const pad = Math.max(4, Math.round(Math.min(spec.width, spec.height) * 0.08));
      ctx.fillRect(pad, pad, spec.width - pad * 2, spec.height - pad * 2);
    } else {
      ctx.beginPath();
      ctx.arc(
        spec.width / 2,
        spec.height / 2,
        Math.min(spec.width, spec.height) * 0.38,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("blob"))), "image/png");
    });
    const form = new FormData();
    const id = crypto.randomUUID();
    form.set("id", id);
    form.set("file", blob, "sticker.png");
    form.set("name", stickerName);
    form.set("animated", "false");
    form.set("width", String(spec.width));
    form.set("height", String(spec.height));
    const response = await fetch("/api/stickers", { method: "POST", body: form });
    if (!response.ok) {
      throw new Error((await response.text()) || "create failed");
    }
    return id;
  }, { name, paint });
}

export async function sendStickerFromTray(page: Page, name?: string) {
  await openStickerTray(page);
  const tile = name
    ? page.getByTestId("sticker-tile").filter({ has: page.getByAltText(name) }).first()
    : page.getByTestId("sticker-tile").first();
  await expect(tile).toBeVisible({ timeout: 20_000 });
  await tile.click();
  await scrollChatToLatest(page);
  await expect(page.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 30_000 });
}

export const stickerOutDir = path.join(__dirname, "..", "..", "visual-qa", "stickers");
