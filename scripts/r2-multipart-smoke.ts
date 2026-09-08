/**
 * Real R2 multipart lifecycle smoke (server-side, then one browser part PUT).
 *
 * Usage: set -a && source .env.local && set +a && pnpm r2:multipart-smoke
 */
import { randomUUID } from "node:crypto";

import { INTEGRATION_TEST_PREFIX } from "../src/lib/storage/object-keys";
import { createR2StorageProvider } from "../src/lib/storage/r2";

import { chromium } from "@playwright/test";

const PART = 5 * 1024 * 1024;
const ORIGIN = "http://localhost:3000";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function fakeMp4(size: number) {
  const body = new Uint8Array(size);
  body[3] = 24;
  body.set([0x66, 0x74, 0x79, 0x70], 4);
  body.set([0x69, 0x73, 0x6f, 0x6d], 8);
  return body;
}

async function main() {
  const storage = createR2StorageProvider({
    accountId: requireEnv("R2_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
    endpoint: requireEnv("R2_ENDPOINT"),
  });

  const key = `${INTEGRATION_TEST_PREFIX}video-multipart/${randomUUID()}.mp4`;
  const body = fakeMp4(PART * 2);
  const created = await storage.createMultipartUpload({
    key,
    contentType: "video/mp4",
  });

  let completed = false;
  try {
    const part2 = body.slice(PART);
    const signed1 = await storage.createSignedPartUploadUrl({
      key,
      uploadId: created.uploadId,
      partNumber: 1,
      contentType: "application/octet-stream",
    });

    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const put = await page.evaluate(
      async ({ url, bytes }) => {
        const payload = new Uint8Array(bytes);
        payload[3] = 24;
        payload.set([0x66, 0x74, 0x79, 0x70], 4);
        payload.set([0x69, 0x73, 0x6f, 0x6d], 8);
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: payload,
        });
        return {
          ok: response.ok,
          status: response.status,
          etag: response.headers.get("etag"),
        };
      },
      { url: signed1.url, bytes: PART },
    );
    await browser.close();
    if (!put.ok || !put.etag) {
      throw new Error(`Browser part PUT failed: ${JSON.stringify(put)}`);
    }

    const signed2 = await storage.createSignedPartUploadUrl({
      key,
      uploadId: created.uploadId,
      partNumber: 2,
      contentType: "application/octet-stream",
    });
    const uploaded2 = await fetch(signed2.url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: part2,
    });
    if (!uploaded2.ok) throw new Error(`Server part 2 failed: ${uploaded2.status}`);

    const listed = await storage.listMultipartParts({ key, uploadId: created.uploadId });
    if (listed.length !== 2) throw new Error(`expected 2 parts, got ${listed.length}`);

    await storage.completeMultipartUpload({
      key,
      uploadId: created.uploadId,
      parts: listed.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
    });
    completed = true;

    const range = await storage.getObjectRange?.(key, 0, 63);
    if (!range || range.byteLength !== 64) throw new Error("Range GET failed");
    const head = await storage.headObject(key);
    if (!head || head.size !== body.byteLength) throw new Error("size mismatch");

    await storage.deleteObject(key);
    const gone = await storage.headObject(key);
    if (gone) throw new Error("object still present");

    console.log(
      JSON.stringify(
        {
          ok: true,
          key,
          parts: listed.length,
          browserPartEtag: put.etag,
          rangeBytes: range.byteLength,
          cleanedUp: true,
          publicAccess: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (!completed) {
      await storage.abortMultipartUpload({ key, uploadId: created.uploadId }).catch(() => undefined);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
