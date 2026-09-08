import { expect, type Page } from "@playwright/test";
import path from "node:path";

import { scrollChatToLatest } from "./media";

export const doodleOutDir = path.join(process.cwd(), "visual-qa", "doodles");

type DoodleDocument = {
  version: 1;
  aspectRatio: number;
  backgroundMode: "paper";
  strokes: Array<{
    id: string;
    tool: "pen" | "marker";
    color: string;
    width: number;
    opacity: number;
    points: number[];
  }>;
};

function stroke(
  id: string,
  color: string,
  points: Array<[number, number]>,
  tool: "pen" | "marker" = "pen",
  width = 0.02,
  opacity = 1,
) {
  return {
    id,
    tool,
    color,
    width,
    opacity,
    points: points.flatMap(([x, y]) => [x, y, 0.5]),
  };
}

export function heartDocument(color = "#d9899c"): DoodleDocument {
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes: [
      stroke("heart-l", color, [
        [0.5, 0.72],
        [0.28, 0.5],
        [0.24, 0.36],
        [0.32, 0.26],
        [0.46, 0.3],
        [0.5, 0.4],
      ]),
      stroke("heart-r", color, [
        [0.5, 0.4],
        [0.54, 0.3],
        [0.68, 0.26],
        [0.76, 0.36],
        [0.72, 0.5],
        [0.5, 0.72],
      ]),
    ],
  };
}

export function almostEmptyDocument(): DoodleDocument {
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes: [stroke("dot", "#4a756c", [[0.48, 0.5], [0.52, 0.51]], "pen", 0.012)],
  };
}

export function blackDocument(): DoodleDocument {
  return heartDocument("#2a2622");
}

export function whiteDocument(): DoodleDocument {
  return heartDocument("#fffdf9");
}

export function paleDocument(): DoodleDocument {
  return heartDocument("#e4c15a");
}

export function thinDocument(): DoodleDocument {
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes: [
      stroke(
        "thin",
        "#4a756c",
        [
          [0.18, 0.22],
          [0.45, 0.4],
          [0.78, 0.28],
        ],
        "pen",
        0.008,
      ),
    ],
  };
}

export function thickDocument(): DoodleDocument {
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes: [
      stroke(
        "thick",
        "#c48b7a",
        [
          [0.2, 0.35],
          [0.55, 0.5],
          [0.78, 0.62],
        ],
        "pen",
        0.07,
      ),
    ],
  };
}

export function denseDocument(): DoodleDocument {
  const strokes = Array.from({ length: 36 }, (_, i) => {
    const y = 0.1 + (i / 36) * 0.78;
    return stroke(`d${i}`, "#4a756c", [
      [0.12, y],
      [0.38 + (i % 5) * 0.05, y + 0.012],
      [0.86, y],
    ]);
  });
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes,
  };
}

export function mixedToolDocument(): DoodleDocument {
  return {
    version: 1,
    aspectRatio: 0.8,
    backgroundMode: "paper",
    strokes: [
      stroke("pen", "#4a756c", [
        [0.2, 0.2],
        [0.4, 0.25],
        [0.55, 0.4],
      ]),
      stroke(
        "marker",
        "#e4c15a",
        [
          [0.25, 0.55],
          [0.7, 0.55],
        ],
        "marker",
        0.06,
        0.38,
      ),
      stroke("ink", "#2a2622", [
        [0.3, 0.75],
        [0.65, 0.78],
      ]),
      stroke("white", "#fffdf9", [
        [0.2, 0.82],
        [0.5, 0.84],
      ]),
    ],
  };
}

export async function openDoodleEditor(page: Page) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-pick-doodle").click();
  await expect(page.getByTestId("doodle-editor")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("doodle-canvas")).toBeVisible();
}

export async function drawStroke(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 14,
) {
  const canvas = page.getByTestId("doodle-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("doodle canvas has no box");
  const startX = box.x + from.x * box.width;
  const startY = box.y + from.y * box.height;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.mouse.move(startX + (to.x - from.x) * t * box.width, startY + (to.y - from.y) * t * box.height);
  }
  await page.mouse.up();
}

export async function drawHeart(page: Page) {
  await drawStroke(page, { x: 0.5, y: 0.7 }, { x: 0.28, y: 0.36 }, 16);
  await drawStroke(page, { x: 0.5, y: 0.7 }, { x: 0.72, y: 0.36 }, 16);
}

export async function sendOpenDoodle(page: Page) {
  const send = page.getByTestId("doodle-send");
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
  await expect(page.getByTestId("doodle-editor")).toHaveCount(0, { timeout: 15_000 });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await scrollChatToLatest(page);
    if (await page.getByTestId("doodle-bubble").last().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(350);
  }
  await expect(page.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 1_000 });
}

export async function sendDoodleViaApi(page: Page, document: DoodleDocument = heartDocument()) {
  const sent = await page.evaluate(async (payload) => {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doodle: payload,
        clientGeneratedId: crypto.randomUUID(),
      }),
    });
    const body = (await response.json()) as { message?: { id: string; type: string } };
    return { ok: response.ok, id: body.message?.id ?? null, type: body.message?.type ?? null };
  }, document);
  expect(sent.ok).toBe(true);
  expect(sent.type).toBe("doodle");
  await scrollChatToLatest(page);
  await expect(page.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 20_000 });
  return sent.id;
}

export async function lastDoodleMessage(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/messages?limit=20", { cache: "no-store" });
    const body = (await response.json()) as {
      messages: Array<{
        id: string;
        type: string;
        doodle?: { document?: { strokes?: Array<{ tool: string; color: string; points: number[] }> } };
      }>;
    };
    return body.messages.filter((message) => message.type === "doodle").at(-1) ?? null;
  });
}

export type { DoodleDocument };
