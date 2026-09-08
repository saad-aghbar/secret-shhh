import { expect, test, type Page } from "@playwright/test";

import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

/**
 * Real-bucket acceptance for voice: run with STORAGE_PROVIDER=r2 against the
 * private bucket. Everything here is about the bytes actually landing in R2 and
 * only being reachable through an expiring, authenticated URL.
 */
test.use({ permissions: ["microphone"] });

async function recordAndSend(page: Page, ms: number) {
  await page.getByTestId("voice-start").click();
  await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
    timeout: 20_000,
  });
  await page.waitForTimeout(ms);
  await page.getByTestId("voice-stop").click();
  await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("voice-send").click();
  await scrollChatToLatest(page);
  const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
  await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
    timeout: 240_000,
  });
  return row.last().getByTestId("voice-bubble");
}

test.describe("voice real R2 acceptance", () => {
  test.beforeEach(() => {
    test.skip(process.env.STORAGE_PROVIDER !== "r2", "Requires STORAGE_PROVIDER=r2");
  });

  test("Saad records, R2 stores it, Tala plays the original", async ({ browser }) => {
    test.setTimeout(600_000);
    const saadCtx = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const talaCtx = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const saad = await saadCtx.newPage();
    const tala = await talaCtx.newPage();
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    // Voice notes carry no caption, so identity comes from the newest row id.
    const lastRowId = async (page: Page) => {
      await scrollChatToLatest(page);
      const rows = page.locator("[data-message-id]");
      const count = await rows.count();
      return count === 0 ? null : rows.nth(count - 1).getAttribute("data-message-id");
    };
    const before = await lastRowId(tala);
    await recordAndSend(saad, 3_000);

    // The partner receives it live and plays it from R2.
    await expect.poll(async () => lastRowId(tala), { timeout: 120_000 }).not.toBe(before);

    const received = tala.getByTestId("voice-bubble").last();
    await expect(received).toHaveAttribute("data-side", "incoming");
    await received.getByTestId("voice-play").click();
    await expect(received).toHaveAttribute("data-playing", "true", { timeout: 60_000 });

    const src = await received.locator("audio").getAttribute("src");
    expect(src, "playback should resolve to a URL").toBeTruthy();

    // The URL must be signed and expiring, never a public bucket path.
    expect(src!).toMatch(/X-Amz-Signature|token=|\/api\/media\//u);

    const authorized = await fetch(src!);
    expect(authorized.status, `signed GET should be 200, got ${authorized.status}`).toBe(200);
    const bytes = Buffer.from(await authorized.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    // The container is what the browser recorded — the original, not a transcode.
    const head = bytes.subarray(0, 12);
    const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    const isMp4 = head.subarray(4, 8).toString("latin1") === "ftyp";
    const isOgg = head.subarray(0, 4).toString("latin1") === "OggS";
    expect(
      isWebm || isMp4 || isOgg,
      `stored bytes should still be a recorded container, got ${head.toString("hex")}`,
    ).toBe(true);
    console.log("voiceR2", {
      bytes: bytes.byteLength,
      container: isMp4 ? "mp4" : isWebm ? "webm" : "ogg",
      contentType: authorized.headers.get("content-type"),
    });

    // Stripping the signature must not work.
    const url = new URL(src!);
    for (const key of [...url.searchParams.keys()]) url.searchParams.delete(key);
    const unsigned = await fetch(url.toString());
    expect(
      unsigned.status,
      `unsigned GET should be denied, got ${unsigned.status}`,
    ).toBeGreaterThanOrEqual(400);

    // A logged-out browser cannot reach the proxy route either.
    const anonCtx = await browser.newContext();
    const anon = await anonCtx.newPage();
    const anonResponse = await anon.request.get(src!.startsWith("/") ? src! : src!, {
      failOnStatusCode: false,
    });
    if (src!.includes("/api/media/")) {
      expect(anonResponse.status()).toBeGreaterThanOrEqual(400);
    }
    await anonCtx.close();

    await saadCtx.close();
    await talaCtx.close();
  });

  test("a long recording survives the round trip and seeks", async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    // 45s is long enough to exercise a real upload and a real seek.
    const bubble = await recordAndSend(page, 45_000);
    await expect(bubble.getByTestId("voice-time")).toHaveText(/0:4\d/u);

    await bubble.getByTestId("voice-play").click();
    await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 60_000 });

    const audio = bubble.locator("audio");
    await expect
      .poll(async () => audio.evaluate((node: HTMLAudioElement) => node.duration), {
        timeout: 30_000,
      })
      .toBeGreaterThan(30);

    // Seek into the body of the clip — End would fire `ended` and reset the clock to idle.
    const scrubber = bubble.getByTestId("voice-scrubber");
    const box = await scrubber.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
    await expect
      .poll(async () => Number((await scrubber.getAttribute("aria-valuenow")) ?? 0), {
        timeout: 30_000,
      })
      .toBeGreaterThan(30_000);

    const played = await audio.evaluate((node: HTMLAudioElement) => node.currentTime);
    expect(played).toBeGreaterThan(30);
  });

  test("saving the original downloads the recorded file", async ({ browser }) => {
    test.setTimeout(600_000);
    const saadCtx = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const saad = await saadCtx.newPage();
    await loginAs(saad, "Saad");
    await recordAndSend(saad, 2_500);

    const talaCtx = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const tala = await talaCtx.newPage();
    await loginAs(tala, "Tala");
    await scrollChatToLatest(tala);
    const received = tala.getByTestId("voice-bubble").last();
    await expect(received).toBeVisible({ timeout: 60_000 });
    await received.getByTestId("voice-play").click();
    await expect(received).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await expect(received.getByTestId("voice-save")).toBeVisible({ timeout: 15_000 });

    const download = tala.waitForEvent("download", { timeout: 60_000 });
    await received.getByTestId("voice-save").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.(m4a|webm|ogg|aac)$/u);
    const stream = await file.createReadStream();
    let size = 0;
    for await (const chunk of stream) size += (chunk as Buffer).byteLength;
    expect(size).toBeGreaterThan(1_000);
    console.log("voiceSave", file.suggestedFilename(), size);

    await saadCtx.close();
    await talaCtx.close();
  });
});
