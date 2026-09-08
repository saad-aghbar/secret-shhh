import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { applyCallPreview } from "./helpers/calls";
import { DESKTOP, loginAs } from "./helpers/media";
import { putThemeViaApi, resetThemeState } from "./helpers/theme";

const outDir = path.join(process.cwd(), "visual-qa", "calls");

const viewports = [
  { name: "320", width: 320, height: 700 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "desktop", ...DESKTOP },
] as const;

const states: Array<{ name: string; preview: Record<string, unknown> }> = [
  { name: "incoming-audio", preview: { type: "audio", role: "callee", status: "ringing" } },
  { name: "outgoing-audio", preview: { type: "audio", role: "caller", status: "ringing" } },
  {
    name: "connected-audio",
    preview: {
      type: "audio",
      role: "caller",
      status: "connected",
      answeredAt: new Date(Date.now() - 38_000).toISOString(),
    },
  },
  {
    name: "muted-audio",
    preview: { type: "audio", role: "caller", status: "connected", muted: true },
  },
  {
    name: "speaker-on-audio",
    preview: {
      type: "audio",
      role: "caller",
      status: "connected",
      speakerOn: true,
      answeredAt: new Date(Date.now() - 38_000).toISOString(),
    },
  },
  {
    name: "failed-audio",
    preview: { type: "audio", role: "caller", status: "connecting", permission: "failed" },
  },
  {
    name: "permission-denied",
    preview: { type: "audio", role: "caller", status: "connecting", permission: "denied" },
  },
  { name: "incoming-video", preview: { type: "video", role: "callee", status: "ringing" } },
  { name: "outgoing-video", preview: { type: "video", role: "caller", status: "ringing" } },
  {
    name: "connected-video",
    preview: { type: "video", role: "callee", status: "connected", cameraOn: true },
  },
  {
    name: "camera-off",
    preview: { type: "video", role: "caller", status: "connected", cameraOn: false },
  },
  {
    name: "upgraded-video",
    preview: {
      type: "video",
      role: "callee",
      status: "connected",
      cameraOn: false,
      videoUpgradeNote: true,
      videoUpgradedBy: "partner",
      answeredAt: new Date(Date.now() - 12_000).toISOString(),
    },
  },
  {
    name: "weak-connection",
    preview: { type: "video", role: "caller", status: "connected", network: "weak" },
  },
  {
    name: "minimized",
    preview: { type: "audio", role: "caller", status: "connected", minimized: true },
  },
];

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function setMode(page: Page, mode: "light" | "dark") {
  await page.evaluate(async (value) => {
    await fetch("/api/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: value }),
    });
  }, mode);
  await page.reload();
  await expect(page.getByTestId("start-audio-call")).toBeVisible();
}

test.describe("calls visual QA", () => {
  test.describe.configure({ retries: 0 });

  test("every required state across viewports and themes", async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await resetThemeState(page);
    await page.goto("/chat");

    const themes: Array<{ name: string; apply: () => Promise<void> }> = [
      { name: "light", apply: async () => setMode(page, "light") },
      { name: "dark", apply: async () => setMode(page, "dark") },
      {
        name: "custom-light",
        apply: async () => {
          await setMode(page, "light");
          await putThemeViaApi(page, "light", {
            version: 1,
            preset: "blush",
            colors: { accent: "#c48b7a", outgoing: "#7eb8ff" },
          });
          await page.reload();
          await expect(page.getByTestId("start-audio-call")).toBeVisible();
        },
      },
      {
        name: "custom-dark",
        apply: async () => {
          await setMode(page, "dark");
          await putThemeViaApi(page, "dark", {
            version: 1,
            preset: "midnight",
            colors: { accent: "#d4a090", background: "#1a1614" },
          });
          await page.reload();
          await expect(page.getByTestId("start-audio-call")).toBeVisible();
        },
      },
    ];

    for (const theme of themes) {
      await theme.apply();
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await shot(page, `${theme.name}-${viewport.name}-chat-header`);
        for (const state of states) {
          await applyCallPreview(page, {
            ...state.preview,
            partnerName: "Tala with a very long display name",
          });
          if (state.name === "minimized") {
            await expect(page.getByTestId("active-call-pill")).toBeVisible();
          } else {
            await expect(page.getByTestId("call-surface")).toBeVisible();
          }
          await shot(page, `${theme.name}-${viewport.name}-${state.name}`);
        }
        await applyCallPreview(page, null);
      }
    }
  });
});
