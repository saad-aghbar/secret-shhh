import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs, MOBILE, revealLatestCaption, scrollChatToLatest } from "./helpers/media";

test.use({ permissions: ["microphone"] });

/**
 * Chromium's fake device produces a beep, so the recorder gets real audio frames
 * and a real WebM/Opus blob — the whole record → upload → play path is exercised.
 */
async function record(page: Page, ms = 1_600) {
  await page.getByTestId("voice-start").click();
  const bar = page.getByTestId("voice-recording");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-phase", "recording", { timeout: 20_000 });
  await page.waitForTimeout(ms);
  await page.getByTestId("voice-stop").click();
  await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
}

async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) return;
    const original = media.getUserMedia.bind(media);
    const streams: MediaStream[] = [];
    (window as unknown as { __shhhStreams: MediaStream[] }).__shhhStreams = streams;
    media.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
}

async function micReleased(page: Page) {
  return page.evaluate(() => {
    const streams = (window as unknown as { __shhhStreams?: MediaStream[] }).__shhhStreams ?? [];
    return (
      streams.length > 0 &&
      streams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"))
    );
  });
}

/** Newest voice bubble in view, after making sure the virtualized list has it mounted. */
async function latestVoice(page: Page) {
  await scrollChatToLatest(page);
  const bubbles = page.getByTestId("voice-bubble");
  await expect(bubbles.last()).toBeVisible({ timeout: 30_000 });
  return bubbles.last();
}

/** Newest note you sent — partner threads should use `latestVoice` instead. */
async function latestOwnVoice(page: Page) {
  await scrollChatToLatest(page);
  const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
  const bubble = row.last().getByTestId("voice-bubble");
  await expect(bubble).toBeVisible({ timeout: 30_000 });
  return bubble;
}

/** Tap the pill until it reads `target`; the speed persists between sessions. */
async function cycleRateTo(pill: Locator, target: string) {
  for (let i = 0; i < 3; i += 1) {
    if ((await pill.textContent())?.trim() === target) break;
    await pill.click();
  }
  await expect(pill).toHaveText(target);
}

/** The queued recording as it actually sits on disk, read straight from IndexedDB. */
async function queuedVoice(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ clientGeneratedId: string; bytes: number }>((resolve, reject) => {
        const request = indexedDB.open("shhh-chat");
        request.onerror = () => reject(new Error("no local db"));
        request.onsuccess = () => {
          const db = request.result;
          const rows = db
            .transaction("pendingVoiceUploads", "readonly")
            .objectStore("pendingVoiceUploads")
            .getAll();
          rows.onerror = () => reject(new Error("no queued voice"));
          rows.onsuccess = () => {
            const queued = rows.result as {
              clientGeneratedId: string;
              createdAt: number;
              blob?: Blob;
            }[];
            const newest = queued.sort((a, b) => b.createdAt - a.createdAt)[0];
            db.close();
            resolve({
              clientGeneratedId: newest?.clientGeneratedId ?? "",
              bytes: newest?.blob?.size ?? 0,
            });
          };
        };
      }),
  );
}

/** How many messages the server actually holds for one client id. */
async function countServerCopies(page: Page, clientGeneratedId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch("/api/messages?limit=100", { credentials: "same-origin" });
    const body = (await response.json()) as { messages?: { clientGeneratedId: string }[] };
    return (body.messages ?? []).filter((message) => message.clientGeneratedId === id).length;
  }, clientGeneratedId);
}

async function seedMessages(page: Page, count: number, prefix: string) {
  await page.evaluate(
    async ({ count: n, prefix: label }) => {
      for (let i = 0; i < n; i += 1) {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${label} ${i}`,
            clientGeneratedId: crypto.randomUUID(),
          }),
        });
        if (!response.ok) {
          throw new Error(`seed failed: ${response.status}`);
        }
      }
    },
    { count, prefix },
  );
  await page.reload();
  await expect(page.getByPlaceholder("Message…")).toBeVisible();
}

async function sendVoice(page: Page, ms = 1_600) {
  await record(page, ms);
  await page.getByTestId("voice-send").click();
  await expect(page.getByTestId("voice-preview")).toHaveCount(0);
  const bubble = await latestOwnVoice(page);
  await expect(bubble).toBeVisible();
  return bubble;
}

test.describe("voice messages", () => {
  test("mic replaces send until there are words to send", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await expect(page.getByTestId("voice-start")).toBeVisible();
    await page.getByPlaceholder("Message…").fill("hi");
    await expect(page.getByTestId("voice-start")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await page.getByPlaceholder("Message…").fill("");
    await expect(page.getByTestId("voice-start")).toBeVisible();
  });

  test("record → preview → send lands a playable voice message", async ({ page }) => {
    test.setTimeout(180_000);
    await trackStreams(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await record(page);
    // Preview lets you hear it before anyone else does.
    await expect(page.getByTestId("voice-preview-play")).toBeVisible();
    await expect(page.getByTestId("voice-rerecord")).toBeVisible();
    await expect(page.getByTestId("voice-discard")).toBeVisible();
    await page.getByTestId("voice-preview-play").click();

    await page.getByTestId("voice-send").click();
    const bubble = await latestVoice(page);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    // The microphone is closed the moment the composer is gone.
    expect(await micReleased(page)).toBe(true);
    await expect(page.getByTestId("voice-recording")).toHaveCount(0);
    await expect(page.getByPlaceholder("Message…")).toBeVisible();

    await expect(bubble.getByTestId("voice-play")).toBeEnabled();
    await expect(bubble.getByTestId("voice-time")).toHaveText(/\d:\d\d/u);
    await expect(bubble.getByTestId("voice-time")).not.toHaveText("0:00");
    await expect(bubble.locator("[data-waveform-bar]").first()).toBeVisible();
  });

  test("plays, shows progress, seeks, and changes speed", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const bubble = await sendVoice(page, 2_400);

    await bubble.getByTestId("voice-play").click();
    await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 30_000 });

    const scrubber = bubble.getByTestId("voice-scrubber");
    await expect
      .poll(async () => Number((await scrubber.getAttribute("aria-valuenow")) ?? 0), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    // Seek into the clip rather than to End — finishing would reset the idle clock.
    const box = await scrubber.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height / 2);
    await expect
      .poll(async () => Number((await scrubber.getAttribute("aria-valuenow")) ?? 0))
      .toBeGreaterThan(50);
    await scrubber.focus();
    await page.keyboard.press("Home");
    await expect
      .poll(async () => Number((await scrubber.getAttribute("aria-valuenow")) ?? 0))
      .toBeLessThan(20);

    if ((await bubble.getByTestId("voice-rate").count()) === 0) {
      await bubble.getByTestId("voice-play").click();
      await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 15_000 });
    }
    const rate = bubble.getByTestId("voice-rate");
    await expect(rate).toBeVisible({ timeout: 10_000 });
    await cycleRateTo(rate, "1×");
    await rate.click();
    await expect(rate).toHaveText("1.5×");
    await rate.click();
    await expect(rate).toHaveText("2×");
    expect(
      await bubble.locator("audio").evaluate((node: HTMLAudioElement) => node.playbackRate),
    ).toBe(2);

    // The speed follows you to the next visit. A resting note shows no pill, so
    // the proof is the rate the audio element actually picks up on play.
    await page.reload();
    await expect(page.getByPlaceholder("Message…")).toBeVisible({ timeout: 30_000 });
    const again = await latestOwnVoice(page);
    await expect(again.getByTestId("voice-rate")).toHaveCount(0);
    await again.getByTestId("voice-play").click();
    await expect(again).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await expect(again.getByTestId("voice-rate")).toHaveText("2×", { timeout: 30_000 });
    expect(
      await again.locator("audio").evaluate((node: HTMLAudioElement) => node.playbackRate),
    ).toBe(2);
    await cycleRateTo(again.getByTestId("voice-rate"), "1×");
  });

  test("only one voice message plays at a time", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendVoice(page, 2_400);
    await sendVoice(page, 2_400);

    await scrollChatToLatest(page);
    const bubbles = page.getByTestId("voice-bubble");
    const count = await bubbles.count();
    const first = bubbles.nth(count - 2);
    const second = bubbles.nth(count - 1);

    await first.getByTestId("voice-play").click();
    await expect(first).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await second.getByTestId("voice-play").click();
    await expect(second).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await expect(first).toHaveAttribute("data-playing", "false");
  });

  test("a tap-and-stop with nothing said is discarded silently", async ({ page }) => {
    await trackStreams(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const before = await page.getByTestId("voice-bubble").count();

    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("voice-hint")).toContainText("Keep talking");
    await page.getByTestId("voice-stop").click();

    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await expect(page.getByTestId("voice-preview")).toHaveCount(0);
    expect(await page.getByTestId("voice-bubble").count()).toBe(before);
    expect(await micReleased(page)).toBe(true);
  });

  test("cancel and re-record leave nothing behind", async ({ page }) => {
    test.setTimeout(120_000);
    await trackStreams(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const before = await page.getByTestId("voice-bubble").count();

    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
      timeout: 20_000,
    });
    await page.waitForTimeout(1_200);
    await page.getByTestId("voice-cancel").click();
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    expect(await micReleased(page)).toBe(true);
    expect(await page.getByTestId("voice-bubble").count()).toBe(before);

    await record(page);
    await page.getByTestId("voice-rerecord").click();
    await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
      timeout: 20_000,
    });
    await page.waitForTimeout(1_200);
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible();
    await page.getByTestId("voice-discard").click();
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    expect(await page.getByTestId("voice-bubble").count()).toBe(before);
    expect(await micReleased(page)).toBe(true);
  });

  test("pause and resume keep one continuous recording", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("voice-start").click();
    const bar = page.getByTestId("voice-recording");
    await expect(bar).toHaveAttribute("data-phase", "recording", { timeout: 20_000 });
    await page.waitForTimeout(1_200);

    const pause = page.getByTestId("voice-pause");
    test.skip((await pause.count()) === 0, "This engine cannot pause a recording");
    await pause.click();
    await expect(bar).toHaveAttribute("data-phase", "paused");
    const frozen = await page.getByTestId("voice-timer").textContent();
    await page.waitForTimeout(1_100);
    expect(await page.getByTestId("voice-timer").textContent()).toBe(frozen);

    await pause.click();
    await expect(bar).toHaveAttribute("data-phase", "recording");
    await page.waitForTimeout(900);
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("voice-discard").click();
  });

  test("denied microphone uses consumer copy and can be retried", async ({ page }) => {
    await page.addInitScript(() => {
      const media = navigator.mediaDevices;
      if (!media) return;
      media.getUserMedia = () =>
        Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("voice-start").click();

    await expect(page.getByTestId("voice-blocked")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Microphone access is off.")).toBeVisible();
    await expect(page.getByText(/getUserMedia|NotAllowedError|MediaStream|mimeType/)).toHaveCount(
      0,
    );
    await expect(page.getByTestId("voice-retry-permission")).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
  });

  test("a busy microphone says so instead of failing silently", async ({ page }) => {
    await page.addInitScript(() => {
      const media = navigator.mediaDevices;
      if (!media) return;
      media.getUserMedia = () =>
        Promise.reject(Object.assign(new Error("busy"), { name: "NotReadableError" }));
    });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.getByTestId("voice-start").click();
    await expect(page.getByText("Something else is using the microphone.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("text chat stays usable while a recording uploads", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await record(page, 1_600);
    await page.getByTestId("voice-send").click();

    const marker = `voice-parallel-${Date.now()}`;
    await page.getByPlaceholder("Message…").fill(marker);
    await page.getByPlaceholder("Message…").press("Enter");
    await revealLatestCaption(page, marker, 60_000);
    await expect(page.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 60_000 },
    );
  });

  test("queues offline and sends when the connection returns", async ({ page, context }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    await record(page, 1_800);
    await context.setOffline(true);
    await page.getByTestId("voice-send").click();
    await expect(page.getByTestId("voice-preview")).toHaveCount(0);

    const bubble = page.getByTestId("voice-bubble").last();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    await expect(bubble.getByTestId("voice-time")).toContainText(/Waiting|Sending/u, {
      timeout: 30_000,
    });

    await context.setOffline(false);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 150_000,
    });
  });

  test("survives a refresh mid-upload and still arrives once", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    // Hang the first byte-push so the reload genuinely lands mid-upload. Going
    // offline instead would only prove the document can't be fetched offline.
    let attempts = 0;
    await page.route(
      /\/api\/media\/uploads\/[^/]+\/content|\/api\/test-storage\/upload\/|r2\.cloudflarestorage\.com/,
      async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await new Promise((resolve) => setTimeout(resolve, 120_000));
        await route.abort();
        return;
      }
      await route.continue();
    });

    await record(page, 1_800);
    await page.getByTestId("voice-send").click();
    await expect((await latestVoice(page)).getByTestId("voice-time")).toContainText(
      /Waiting|Sending/u,
      { timeout: 30_000 },
    );

    // Nothing about the recording may live in memory only: the bytes are on disk,
    // under the id the server will de-duplicate on.
    const queued = await queuedVoice(page);
    expect(queued.clientGeneratedId).toBeTruthy();
    expect(queued.bytes).toBeGreaterThan(0);

    // Kill the tab. The blob has to come back from IndexedDB by itself.
    await page.reload();
    await latestVoice(page);

    // Ask the server, not the rendered window: it has to arrive, and exactly once.
    await expect
      .poll(() => countServerCopies(page, queued.clientGeneratedId), { timeout: 150_000 })
      .toBe(1);
    await page.waitForTimeout(3_000);
    expect(await countServerCopies(page, queued.clientGeneratedId)).toBe(1);

    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await latestVoice(page);
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 60_000,
    });
  });

  test("the partner receives it and can play it", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendVoice(page, 2_000);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    const other = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const partner = await other.newPage();
    await loginAs(partner, "Tala");
    const received = await latestVoice(partner);
    await expect(received).toHaveAttribute("data-side", "incoming");
    await received.getByTestId("voice-play").click();
    await expect(received).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await expect(received.getByTestId("voice-save")).toBeVisible();

    // Reading it marks it read for the sender.
    await expect(row.last()).toHaveAttribute("data-status", "read", { timeout: 60_000 });
    await other.close();
  });

  test("duration stays honest after send, receive, and reload", async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const bubble = await sendVoice(page, 2_400);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    await expect(bubble.getByTestId("voice-time")).toHaveText(/0:0[2-9]|0:[1-9]\d/u);
    const sentClock = (await bubble.getByTestId("voice-time").textContent())?.trim() ?? "";
    expect(sentClock).not.toBe("0:00");

    await bubble.getByTestId("voice-play").click();
    await expect(bubble).toHaveAttribute("data-playing", "true", { timeout: 30_000 });
    await expect
      .poll(async () => bubble.getAttribute("data-playing"), { timeout: 30_000 })
      .toBe("false");
    await expect(bubble.getByTestId("voice-time")).toHaveText(sentClock);

    await page.reload();
    await expect(page.getByPlaceholder("Message…")).toBeVisible({ timeout: 30_000 });
    const again = await latestVoice(page);
    await expect(again.getByTestId("voice-time")).toHaveText(sentClock);

    const other = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const partner = await other.newPage();
    await loginAs(partner, "Tala");
    const received = await latestVoice(partner);
    await expect(received.getByTestId("voice-time")).toHaveText(sentClock);
    await partner.reload();
    await expect(partner.getByPlaceholder("Message…")).toBeVisible({ timeout: 30_000 });
    const receivedAgain = await latestVoice(partner);
    await expect(receivedAgain.getByTestId("voice-time")).toHaveText(sentClock);
    await other.close();
  });

  test("a voice note arriving while scrolled up raises smart ↓, and lands on it", async ({
    page,
    browser,
  }) => {
    test.setTimeout(360_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await seedMessages(page, 40, `voice-jump ${Date.now()}`);
    await expect(page.getByTestId("chat-experience"))
      .toHaveAttribute("data-realtime", "subscribed", {
        timeout: 12_000,
      })
      .catch(() => undefined);

    const list = page.getByTestId("chat-message-list");
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(400);
    await list.evaluate((el) => {
      el.scrollTop = Math.min(120, Math.max(0, el.scrollHeight / 4));
    });
    await expect
      .poll(async () =>
        list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight > 400),
      )
      .toBe(true);
    const wrap = page.getByTestId("jump-to-latest-wrap");
    await expect(wrap).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "arrow");

    const other = await browser.newContext({ viewport: MOBILE, permissions: ["microphone"] });
    const partner = await other.newPage();
    await loginAs(partner, "Tala");
    await partner
      .locator('[data-testid="chat-experience"][data-realtime="subscribed"]')
      .waitFor({ timeout: 12_000 })
      .catch(() => undefined);

    await record(partner, 1_800);
    await partner.getByTestId("voice-send").click();
    const partnerRow = partner
      .locator('[data-own="true"]')
      .filter({ has: partner.getByTestId("voice-bubble") });
    await expect(partnerRow.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    await page.bringToFront();
    await expect(page.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "unseen", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("jump-to-latest")).toContainText(/new message/i);

    await page.getByTestId("jump-to-latest").click();
    const arrived = page
      .locator('[data-own="false"]')
      .filter({ has: page.getByTestId("voice-bubble") })
      .last();
    await expect(arrived).toBeVisible({ timeout: 30_000 });
    await expect(arrived.getByTestId("voice-bubble")).toHaveAttribute("data-side", "incoming");
    await expect(arrived.getByTestId("voice-play")).toBeEnabled();
    await expect(wrap).toHaveAttribute("data-active", "false", { timeout: 15_000 });
    await other.close();
  });

  test("a Voice search result jumps to that note in the thread", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendVoice(page, 2_000);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Voice", exact: true }).click();
    await page.getByTestId("filters-apply").click();
    await page.getByTestId("search-result").first().click();

    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 30_000 });
    const focused = page.locator('[data-highlighted="true"]');
    await expect(focused).toBeVisible({ timeout: 30_000 });
    await expect(focused.getByTestId("voice-bubble")).toBeVisible();
    await expect(focused.getByTestId("voice-play")).toBeEnabled();
  });

  test("a long recording stays smooth and keeps an honest clock", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    const RECORD_MS = 60_000;
    await page.getByTestId("voice-start").click();
    await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
      timeout: 20_000,
    });

    // Typing is blocked while recording, so responsiveness is measured on the
    // recording bar itself: the live waveform has to keep repainting.
    const startedAt = Date.now();
    await page.waitForTimeout(RECORD_MS / 2);
    const midBars = await page.locator("[data-waveform-bar]").count();
    expect(midBars).toBeGreaterThan(0);
    await page.waitForTimeout(RECORD_MS / 2);

    await expect(page.getByTestId("voice-timer")).toHaveText(/1:0\d|0:5\d/u);

    const stoppedAt = Date.now();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 30_000 });
    // Encoding a minute of audio must not freeze the composer.
    expect(Date.now() - stoppedAt).toBeLessThan(10_000);

    await page.getByTestId("voice-send").click();
    const bubble = await latestVoice(page);
    const uploadRow = page
      .locator('[data-own="true"]')
      .filter({ has: page.getByTestId("voice-bubble") });
    await expect(uploadRow.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 180_000,
    });

    // The stored clock matches the wall clock it was recorded against.
    const label = (await bubble.getByTestId("voice-time").textContent())?.trim() ?? "";
    const [minutes, seconds] = label.split(":").map(Number);
    const shownMs = ((minutes ?? 0) * 60 + (seconds ?? 0)) * 1_000;
    expect(Math.abs(shownMs - (stoppedAt - startedAt))).toBeLessThan(4_000);

    // 64 buckets no matter how long the recording is.
    const bars = await bubble.locator("[data-waveform-bar]").count();
    expect(bars).toBeGreaterThan(8);
    expect(bars).toBeLessThanOrEqual(64);
  });

  test("the Voice filter finds it; words never do", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendVoice(page, 2_000);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    await page.getByRole("button", { name: "Voice", exact: true }).click();
    await page.getByTestId("filters-apply").click();
    await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("search-result").first()).toContainText("Voice message");

    await page.getByTestId("search-input").fill("hello");
    await expect(page.getByText("Voice messages aren't searched by words.")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("voice never clutters the media library or albums", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await sendVoice(page, 1_800);
    const row = page.locator('[data-own="true"]').filter({ has: page.getByTestId("voice-bubble") });
    await expect(row.last()).toHaveAttribute("data-status", /sent|delivered|read/, {
      timeout: 120_000,
    });

    await page.goto("/media");
    await expect(page.getByTestId("media-library")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("voice-bubble")).toHaveCount(0);
    const audioTiles = await page
      .getByTestId("media-thumb")
      .evaluateAll(
        (nodes) => nodes.filter((node) => (node.textContent ?? "").includes("Voice")).length,
      );
    expect(audioTiles).toBe(0);
  });

  test("reduced motion still records and sends", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await record(page, 1_500);
    await expect(page.getByTestId("voice-preview")).toBeVisible();
    await page.getByTestId("voice-send").click();
    await expect(await latestVoice(page)).toBeVisible();
  });

  test("keyboard alone can record, review, and send", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, "Saad");

    await page.getByTestId("voice-start").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("voice-recording")).toHaveAttribute("data-phase", "recording", {
      timeout: 20_000,
    });
    await page.waitForTimeout(1_500);
    await page.getByTestId("voice-stop").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("voice-preview")).toBeVisible({ timeout: 15_000 });

    const scrubber = page.getByTestId("voice-preview").getByTestId("voice-scrubber");
    await expect(scrubber).toHaveAttribute("role", "slider");
    await scrubber.focus();
    await page.keyboard.press("ArrowRight");
    await page.getByTestId("voice-send").focus();
    await page.keyboard.press("Enter");
    await expect(await latestVoice(page)).toBeVisible();
  });
});
