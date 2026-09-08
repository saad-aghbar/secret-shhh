import { expect, test } from "@playwright/test";
import { ListPartsCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

import { loginAs, MOBILE, openMedia, revealLatestCaption, scrollChatToLatest } from "./helpers/media";

const fixtures = path.join(__dirname, "fixtures");
const localDir = path.join(fixtures, "local");

function firstExisting(names: string[]) {
  for (const name of names) {
    const full = path.join(fixtures, name);
    if (fs.existsSync(full)) return full;
    const local = path.join(localDir, name);
    if (fs.existsSync(local)) return local;
  }
  return null;
}

const playable =
  firstExisting(["tiny-landscape.webm", "tiny-landscape.mp4"]) ?? null;
const large64 = firstExisting(["video-64mb.webm", "video-64mb.bin"]);
const large256 = firstExisting(["video-256mb.webm", "video-256mb.bin"]);

test.describe("videos real R2 acceptance", () => {
  test.beforeEach(() => {
    test.skip(process.env.STORAGE_PROVIDER !== "r2", "Requires STORAGE_PROVIDER=r2");
    test.skip(!playable, "Generate video fixtures first");
  });

  test("Saad sends a video, Tala plays it, seeking issues Range", async ({ browser }) => {
    test.setTimeout(300_000);
    const saadCtx = await browser.newContext();
    const talaCtx = await browser.newContext();
    const saad = await saadCtx.newPage();
    const tala = await talaCtx.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const marker = `r2-video-${Date.now()}`;
    await saad.getByTestId("photo-attach").click();
    await saad.getByTestId("media-input").setInputFiles(playable!);
    await saad.getByTestId("video-caption").fill(marker);
    await saad.getByTestId("video-send").click();
    await expect(saad.getByText(marker)).toBeVisible({ timeout: 180_000 });
    await expect(saad.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 180_000 },
    );

    await tala.goto("/chat");
    await revealLatestCaption(tala, marker, 90_000);
    const bubble = tala.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(bubble).toBeVisible({ timeout: 20_000 });

    const rangeHits: string[] = [];
    tala.on("request", (request) => {
      const range = request.headers()["range"];
      if (range && /cloudflarestorage\.com|r2\.cloudflarestorage/i.test(request.url())) {
        rangeHits.push(range);
      }
    });

    await bubble.getByRole("button", { name: /Open video/i }).click();
    await expect(tala.getByTestId("video-player")).toBeVisible({ timeout: 20_000 });
    await tala.getByTestId("video-play-toggle").click();
    const video = tala.locator('[data-testid="video-player"] video');
    await expect(video).toHaveAttribute("src", /https?:\/\//, { timeout: 20_000 });
    const src = await video.getAttribute("src");
    expect(src).toBeTruthy();

    await tala.getByTestId("video-scrubber").evaluate((node) => {
      const input = node as HTMLInputElement;
      const max = Number(input.max) || 1000;
      input.value = String(Math.max(1, Math.round(max * 0.7)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await video.evaluate((node) => {
      const el = node as HTMLVideoElement;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = el.duration * 0.7;
      }
    });
    await tala.waitForTimeout(1_200);

    const nodeRange = await fetch(src!, { headers: { Range: "bytes=0-63" } });
    const nodeBytes = Buffer.from(await nodeRange.arrayBuffer());
    expect(nodeRange.status, `R2 Range GET should be 206, got ${nodeRange.status}`).toBe(206);
    expect(nodeBytes.byteLength).toBe(64);
    console.log("rangeHits", rangeHits, "nodeRange", nodeRange.status);

    expect(
      rangeHits.length,
      "Chromium should issue a Range request to the signed R2 URL while playing/seeking",
    ).toBeGreaterThan(0);

    await tala.keyboard.press("Escape");
    await openMedia(tala, "?type=video");
    await expect(tala.getByTestId("media-type-video")).toHaveAttribute("aria-pressed", "true");

    await saadCtx.close();
    await talaCtx.close();
  });

  test("64 MB two-way send completes on real R2", async ({ browser }) => {
    test.setTimeout(600_000);
    test.skip(!large64, "Need e2e/fixtures/local/video-64mb.webm");
    const saadCtx = await browser.newContext();
    const talaCtx = await browser.newContext();
    const saad = await saadCtx.newPage();
    const tala = await talaCtx.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const heapBefore = await saad.evaluate(
      () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
    );
    const marker = `r2-64mb-${Date.now()}`;
    await saad.getByTestId("photo-attach").click();
    await saad.getByTestId("media-input").setInputFiles(large64!);
    await saad.getByTestId("video-caption").fill(marker);
    await saad.getByTestId("video-send").click();
    await expect(saad.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 30_000,
    });
    await expect(saad.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 480_000 },
    );
    const heapAfter = await saad.evaluate(
      () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
    );
    console.log("heapBytes", { heapBefore, heapAfter, fileBytes: fs.statSync(large64!).size });

    await tala.goto("/chat");
    await revealLatestCaption(tala, marker, 90_000);
    await expect(tala.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible({
      timeout: 20_000,
    });

    await saadCtx.close();
    await talaCtx.close();
  });

  test("256 MB two-way send (manual)", async ({ browser }) => {
    test.setTimeout(900_000);
    test.skip(process.env.RUN_VIDEO_256MB !== "1", "Set RUN_VIDEO_256MB=1 for the manual 256 MB run");
    test.skip(!large256, "Need e2e/fixtures/local/video-256mb.webm");
    const fileBytes = fs.statSync(large256!).size;
    const saadCtx = await browser.newContext();
    const talaCtx = await browser.newContext();
    const saad = await saadCtx.newPage();
    const tala = await talaCtx.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    const proof = {
      r2Puts: 0,
      r2PutPartNumbers: new Set<number>(),
      proxyVideoOriginalPuts: 0,
      posterProxyPuts: 0,
      firstR2PutUrl: null as string | null,
      init: null as null | {
        sessionId: string;
        partSize: number;
        totalParts: number;
        totalBytes: number;
      },
      completeStatus: 0,
    };

    saad.on("request", (request) => {
      const url = request.url();
      const method = request.method();
      if (method === "PUT" && /cloudflarestorage\.com|r2\.cloudflarestorage/i.test(url)) {
        proof.r2Puts += 1;
        try {
          const part = Number(new URL(url).searchParams.get("partNumber") ?? "");
          if (Number.isFinite(part) && part > 0) proof.r2PutPartNumbers.add(part);
        } catch {
          /* ignore */
        }
        if (!proof.firstR2PutUrl) proof.firstR2PutUrl = url;
      }
      if (method === "PUT" && /\/api\/media\/uploads\/[^/]+\/content/.test(url)) {
        const type = request.headers()["content-type"] ?? "";
        const size = request.postDataBuffer()?.byteLength ?? 0;
        if (type.startsWith("video/") || size > 2 * 1024 * 1024) {
          proof.proxyVideoOriginalPuts += 1;
        } else {
          proof.posterProxyPuts += 1;
        }
      }
    });
    saad.on("response", async (response) => {
      const url = response.url();
      const method = response.request().method();
      if (method === "POST" && url.includes("/api/media/video/uploads/init")) {
        try {
          const body = (await response.json()) as typeof proof.init;
          if (body?.sessionId) proof.init = body;
        } catch {
          /* ignore */
        }
      }
      if (method === "POST" && /\/api\/media\/video\/uploads\/[^/]+\/complete/.test(url)) {
        proof.completeStatus = response.status();
      }
    });

    const marker = `r2-256mb-${Date.now()}`;
    const textDuring = `text-during-256-${Date.now()}`;
    await saad.getByTestId("photo-attach").click();
    await saad.getByTestId("media-input").setInputFiles(large256!);
    await saad.getByTestId("video-caption").fill(marker);
    await saad.getByTestId("video-send").click();

    await expect(saad.getByTestId("video-upload-veil")).toBeVisible({ timeout: 60_000 });
    await saad.locator("#shhh-message").fill(textDuring);
    await saad.getByRole("button", { name: "Send", exact: true }).click();
    await expect(saad.getByText(textDuring)).toBeVisible({ timeout: 20_000 });
    const veilStillUp = await saad.getByTestId("video-upload-veil").isVisible();
    expect(veilStillUp, "text should land while the 256 MB video is still uploading").toBe(true);

    await expect.poll(() => proof.init?.totalParts ?? 0, { timeout: 60_000 }).toBeGreaterThan(1);

    await expect(saad.locator('[data-own="true"]').filter({ hasText: marker })).toHaveAttribute(
      "data-status",
      /sent|delivered|read/,
      { timeout: 780_000 },
    );
    expect(proof.completeStatus, "complete should succeed").toBe(200);
    expect(proof.proxyVideoOriginalPuts, "video original must not use the photo proxy").toBe(0);
    expect(proof.init).toBeTruthy();
    expect(proof.init!.partSize).toBe(8 * 1024 * 1024);
    expect(proof.init!.totalBytes).toBe(fileBytes);
    expect(proof.init!.totalParts).toBeGreaterThan(1);
    expect(proof.r2PutPartNumbers.size).toBe(proof.init!.totalParts);
    expect(proof.r2Puts).toBeGreaterThanOrEqual(proof.init!.totalParts);

    await tala.goto("/chat");
    await revealLatestCaption(tala, marker, 120_000);
    const talaBubble = tala.getByTestId("video-bubble").filter({ hasText: marker });
    await expect(talaBubble).toBeVisible({ timeout: 20_000 });

    const rangeHits: string[] = [];
    tala.on("request", (request) => {
      const range = request.headers()["range"];
      if (range && /cloudflarestorage\.com|r2\.cloudflarestorage/i.test(request.url())) {
        rangeHits.push(range);
      }
    });
    await scrollChatToLatest(tala);
    await talaBubble.getByRole("button", { name: /Open video/i }).click();
    await expect(tala.getByTestId("photo-viewer")).toBeVisible({ timeout: 20_000 });
    await expect(tala.getByTestId("video-player")).toBeVisible({ timeout: 20_000 });
    const video = tala.locator('[data-testid="video-player"] video');
    await expect(video).toHaveAttribute("src", /https?:\/\//, { timeout: 20_000 });
    const src = await video.getAttribute("src");
    expect(src).toMatch(/cloudflarestorage\.com|r2\.cloudflarestorage/i);

    const nodeRange = await fetch(src!, { headers: { Range: "bytes=0-63" } });
    const nodeBytes = Buffer.from(await nodeRange.arrayBuffer());
    expect(nodeRange.status, `R2 Range GET should be 206, got ${nodeRange.status}`).toBe(206);
    expect(nodeBytes.byteLength).toBe(64);
    await tala.keyboard.press("Escape");

    await saad.reload();
    await revealLatestCaption(saad, marker, 60_000);
    await expect(saad.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible();
    await tala.reload();
    await revealLatestCaption(tala, marker, 60_000);
    await expect(tala.getByTestId("video-bubble").filter({ hasText: marker })).toBeVisible();

    const leftover = await saad.request.get(`/api/media/video/uploads/${proof.init!.sessionId}`);
    expect(leftover.ok()).toBeTruthy();
    const leftoverJson = (await leftover.json()) as {
      status: string;
      completedParts: unknown[];
    };
    expect(leftoverJson.status).toBe("completed");
    expect(
      leftoverJson.completedParts,
      "completed multipart must not still list in-progress parts",
    ).toEqual([]);

    if (proof.firstR2PutUrl && process.env.R2_ENDPOINT && process.env.R2_BUCKET) {
      const parsed = new URL(proof.firstR2PutUrl);
      const bucket = process.env.R2_BUCKET;
      const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
      const key = pathname.startsWith(`${bucket}/`) ? pathname.slice(bucket.length + 1) : pathname;
      const uploadId = parsed.searchParams.get("uploadId");
      expect(uploadId).toBeTruthy();
      const client = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });
      let listable = false;
      try {
        await client.send(
          new ListPartsCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId!,
          }),
        );
        listable = true;
      } catch {
        listable = false;
      }
      expect(listable, "R2 ListParts on the completed uploadId must fail (no orphan multipart)").toBe(
        false,
      );
    }

    console.log("video256Proof", {
      fileBytes,
      partSize: proof.init!.partSize,
      totalParts: proof.init!.totalParts,
      r2Puts: proof.r2Puts,
      r2PutPartNumbers: proof.r2PutPartNumbers.size,
      proxyVideoOriginalPuts: proof.proxyVideoOriginalPuts,
      posterProxyPuts: proof.posterProxyPuts,
      completeStatus: proof.completeStatus,
      nodeRange: nodeRange.status,
      chromiumRangeHits: rangeHits.length,
      leftoverStatus: leftoverJson.status,
      publicAccess: false,
    });

    await saadCtx.close();
    await talaCtx.close();
  });
});
