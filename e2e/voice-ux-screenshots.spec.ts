import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { loginAs, fixtureJpeg, scrollChatToLatest } from "./helpers/media";

const outDir = path.join(__dirname, "..", "visual-qa", "voice-ux");

test.use({ permissions: ["microphone"] });

async function shot(page: Page, name: string) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

async function startRecording(page: Page, ms: number) {
  await page.getByTestId("voice-start").click();
  await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
    timeout: 20_000,
  });
  await page.waitForTimeout(ms);
}

async function sendVoice(page: Page, ms: number, waitForSent = true) {
  await scrollChatToLatest(page);
  const beforeId = await page.locator("[data-message-id]").last().getAttribute("data-message-id");
  await startRecording(page, ms);
  await page.getByTestId("voice-stop").click();
  await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("voice-send").click();
  await expect(page.getByTestId("voice-start")).toBeVisible({ timeout: 20_000 });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await scrollChatToLatest(page);
    const last = page.locator("[data-message-id]").last();
    const id = await last.getAttribute("data-message-id").catch(() => null);
    if (id && id !== beforeId && (await last.getByTestId("voice-bubble").count())) {
      if (waitForSent) {
        await expect(last).toHaveAttribute("data-status", /sent|delivered|read/, {
          timeout: 120_000,
        });
      }
      return;
    }
    await page.waitForTimeout(250);
  }

  await expect(page.locator("[data-message-id]").last().getByTestId("voice-bubble")).toBeVisible({
    timeout: 1_000,
  });
}

test.describe("voice UX visual capture", () => {
  test.describe.configure({ retries: 1 });
  test("light mobile: mic, recording, preview, sent bubble", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await shot(page, "light-composer-mic");

    await startRecording(page, 5_000);
    await shot(page, "light-recording");
    const overflowRecording = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowRecording).toBe(false);
    fs.mkdirSync(outDir, { recursive: true });
    await page
      .getByTestId("voice-recording")
      .screenshot({ path: path.join(outDir, "light-recording-closeup.png") });

    const bar = page.getByTestId("voice-recording");
    const pause = page.getByTestId("voice-pause");
    if (await pause.count()) {
      await pause.click();
      await expect(bar).toHaveAttribute("data-phase", "paused");
      await shot(page, "light-paused");
      await pause.click();
      await page.waitForTimeout(600);
    }

    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await shot(page, "light-preview");
    await page
      .getByTestId("voice-preview")
      .screenshot({ path: path.join(outDir, "light-preview-closeup.png") });

    await page.getByTestId("voice-preview-play").click();
    await page.waitForTimeout(700);
    await shot(page, "light-preview-playing");

    await page.getByTestId("voice-send").click();
    await scrollChatToLatest(page);
    const bubble = page.getByTestId("voice-bubble").last();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 150_000,
    });
    await shot(page, "light-sent-bubble");

    await bubble.getByTestId("voice-play").click();
    await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "light-playing");
    fs.mkdirSync(outDir, { recursive: true });
    await bubble.screenshot({ path: path.join(outDir, "light-bubble-closeup.png") });
  });

  test("dark mobile: recording, preview, both bubble sides", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await startRecording(page, 2_000);
    await shot(page, "dark-recording");
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await shot(page, "dark-preview");
    await page.getByTestId("voice-send").click();
    await scrollChatToLatest(page);
    await expect(page.getByTestId("voice-bubble").last()).toBeVisible({ timeout: 30_000 });
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 150_000,
    });
    await shot(page, "dark-sent-bubble");

    // The partner's side: an incoming voice note in dark mode.
    const other = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      permissions: ["microphone"],
    });
    const partner = await other.newPage();
    await loginAs(partner, "Tala");
    await scrollChatToLatest(partner);
    const incoming = partner.getByTestId("voice-bubble").last();
    await expect(incoming).toBeVisible({ timeout: 30_000 });
    await shot(partner, "dark-incoming");
    fs.mkdirSync(outDir, { recursive: true });
    await incoming.screenshot({ path: path.join(outDir, "dark-incoming-closeup.png") });
    await other.close();
  });

  test("small phone and desktop widths hold the layout", async ({ page }) => {
    test.setTimeout(240_000);
    // iPhone SE is the tightest supported width.
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAs(page, "Saad");

    await startRecording(page, 1_800);
    await shot(page, "se-recording");
    const overflowRecording = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowRecording).toBe(false);

    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await shot(page, "se-preview");
    const overflowPreview = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowPreview).toBe(false);
    await page.getByTestId("voice-send").click();
    await scrollChatToLatest(page);
    await expect(page.getByTestId("voice-bubble").last()).toBeVisible({ timeout: 30_000 });
    await shot(page, "se-sent-bubble");

    await page.setViewportSize({ width: 1440, height: 900 });
    await scrollChatToLatest(page);
    await shot(page, "desktop-thread");
    await startRecording(page, 1_500);
    await shot(page, "desktop-recording");
    await page.getByTestId("voice-cancel").click();
  });

  test("short and long clips size their track differently", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await sendVoice(page, 1_200);
    await sendVoice(page, 8_000);
    await scrollChatToLatest(page);

    const bubbles = page.getByTestId("voice-bubble");
    const count = await bubbles.count();
    const shortBox = await bubbles.nth(count - 2).boundingBox();
    const longBox = await bubbles.nth(count - 1).boundingBox();
    expect(shortBox && longBox).toBeTruthy();
    expect(longBox!.width).toBeGreaterThan(shortBox!.width);
    await shot(page, "light-short-vs-long");
  });

  test("microphone blocked state", async ({ page }) => {
    await page.addInitScript(() => {
      const media = navigator.mediaDevices;
      if (!media) return;
      media.getUserMedia = () =>
        Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-blocked")).toBeVisible({ timeout: 15_000 });
    // Let the settle animation finish so the card is captured at rest.
    await page.waitForTimeout(500);
    await shot(page, "light-blocked");
    fs.mkdirSync(outDir, { recursive: true });
    await page
      .getByTestId("voice-blocked")
      .screenshot({ path: path.join(outDir, "light-blocked-closeup.png") });

    await page.emulateMedia({ colorScheme: "dark" });
    await shot(page, "dark-blocked");
  });

  test("search Voice filter and history day row", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await sendVoice(page, 1_600);

    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Voice", exact: true }).click();
    await page.getByTestId("filters-apply").click();
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 30_000 });
    await shot(page, "light-search-voice");

    await page.getByTestId("search-input").fill("hello");
    await expect(page.getByText("Voice messages aren't searched by words.")).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, "light-search-voice-words");

    await page.goto("/history");
    const today = page.locator('[data-testid="history-day"][data-active="true"]').last();
    if (await today.count()) {
      await today.click();
      await expect(page.getByTestId("history-day-messages")).toBeVisible({ timeout: 30_000 });
      await shot(page, "light-history-day");
    }
  });

  test("desktop dark: recording, preview, playing", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "Saad");

    await startRecording(page, 2_000);
    await shot(page, "dark-desktop-recording");
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await shot(page, "dark-desktop-preview");
    await page.getByTestId("voice-send").click();
    await scrollChatToLatest(page);
    const bubble = page.getByTestId("voice-bubble").last();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await bubble.getByTestId("voice-play").click();
    await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await shot(page, "dark-desktop-playing");
  });

  test("offline sending and mixed media thread", async ({ page }) => {
    test.setTimeout(480_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    const box = page.getByPlaceholder("Message…");
    await box.fill("hey — mixed thread");
    await box.press("Enter");
    await expect(page.getByText("hey — mixed thread").first()).toBeVisible({ timeout: 30_000 });

    const photoCaption = `voice-mix-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles(fixtureJpeg);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await page.getByTestId("photo-caption").fill(photoCaption);
    await page.getByTestId("photo-send").click();
    await expect(page.getByText(photoCaption).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-own="true"]').filter({ hasText: photoCaption })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 120_000 },
    );

    await sendVoice(page, 1_600);
    await expect(page.getByTestId("voice-start")).toBeVisible({ timeout: 20_000 });

    const videoFixture = path.join(__dirname, "fixtures", "tiny-landscape.webm");
    if (fs.existsSync(videoFixture)) {
      const clipCaption = `clip in the mix ${Date.now()}`;
      await page.getByTestId("photo-attach").click();
      await page.getByTestId("media-input").setInputFiles(videoFixture);
      await expect(page.getByTestId("video-selection")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("video-caption").fill(clipCaption);
      await page.getByTestId("video-send").click();
      const videoRow = page.locator('[data-own="true"]').filter({ hasText: clipCaption });
      await expect(videoRow.last()).toBeVisible({ timeout: 45_000 });
      await expect(videoRow.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
        timeout: 120_000,
      });
    }

    await expect(page.getByTestId("voice-start")).toBeVisible({ timeout: 20_000 });
    await sendVoice(page, 1_800);
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await box.fill("and a last text");
    await box.press("Enter");
    await expect(page.getByText("and a last text").first()).toBeVisible({ timeout: 30_000 });
    await scrollChatToLatest(page);
    await shot(page, "light-mixed-thread");
  });

  test("offline sending stays in the bubble", async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    await startRecording(page, 1_600);
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await context.setOffline(true);
    await page.getByTestId("voice-send").click();
    await expect(page.getByTestId("voice-preview")).toHaveCount(0);

    const bubble = page.getByTestId("voice-bubble").last();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await expect(bubble.getByTestId("voice-time")).toContainText(/Waiting|Sending/u, {
      timeout: 30_000,
    });
    await shot(page, "light-offline");
    await context.setOffline(false);
  });

  test("light incoming and failed playback", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await sendVoice(page, 1_800);

    const other = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ["microphone"],
    });
    const partner = await other.newPage();
    await loginAs(partner, "Tala");
    await scrollChatToLatest(partner);
    const incoming = partner.getByTestId("voice-bubble").last();
    await expect(incoming).toBeVisible({ timeout: 30_000 });
    await shot(partner, "light-incoming");
    await incoming.screenshot({ path: path.join(outDir, "light-incoming-closeup.png") });
    await other.close();

    await page.route("**/api/media/**/url*", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.reload();
    await expect(page.getByPlaceholder("Message…")).toBeVisible({ timeout: 30_000 });
    await scrollChatToLatest(page);
    const bubble = page
      .locator('[data-own="true"]')
      .filter({ has: page.getByTestId("voice-bubble") })
      .last()
      .getByTestId("voice-bubble");
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await bubble.getByTestId("voice-play").click();
    await expect(bubble.getByText(/can't be played/i)).toBeVisible({ timeout: 20_000 });
    await shot(page, "light-failed");
    await bubble.screenshot({ path: path.join(outDir, "light-failed-closeup.png") });
  });
});
