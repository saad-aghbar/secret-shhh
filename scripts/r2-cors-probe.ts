/**
 * Gate 0 for Phase 6: prove a real browser can PUT a multipart part to private R2.
 *
 * Uses Playwright Chromium from http://localhost:3000 so the request is a genuine
 * cross-origin PUT (preflight + ETag read). Does not make the bucket public.
 *
 * Usage:
 *   set -a && source .env.local && set +a && pnpm r2:cors-probe
 *
 * Prefix: integration-tests/video-multipart/
 * Always aborts leftover multipart state and deletes the object.
 */
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { INTEGRATION_TEST_PREFIX } from "../src/lib/storage/object-keys";

const PART_BYTES = 5 * 1024 * 1024;
const ORIGIN = "http://localhost:3000";
const VIDEO_TEST_PREFIX = `${INTEGRATION_TEST_PREFIX}video-multipart/`;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Configure private R2 credentials first.`);
  }
  return value;
}

function createClient() {
  return new S3Client({
    region: "auto",
    endpoint: requireEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

type BrowserPutResult = {
  ok: boolean;
  status: number;
  etag: string | null;
  error: string | null;
  sawPreflight: boolean;
  preflightStatus: number | null;
  preflightAllowOrigin: string | null;
  putExposeHeaders: string | null;
  putAllowOrigin: string | null;
};

async function browserPutPart(input: {
  url: string;
  contentType: string;
  bytes: number;
}): Promise<BrowserPutResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let sawPreflight = false;
  let preflightStatus: number | null = null;
  let preflightAllowOrigin: string | null = null;
  let putExposeHeaders: string | null = null;
  let putAllowOrigin: string | null = null;
  page.on("response", (response) => {
    if (!response.url().includes("cloudflarestorage.com")) return;
    if (response.request().method() === "OPTIONS") {
      sawPreflight = true;
      preflightStatus = response.status();
      preflightAllowOrigin = response.headers()["access-control-allow-origin"] ?? null;
    }
    if (response.request().method() === "PUT") {
      putExposeHeaders = response.headers()["access-control-expose-headers"] ?? null;
      putAllowOrigin = response.headers()["access-control-allow-origin"] ?? null;
    }
  });

  try {
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const result = await page.evaluate(
      async ({ url, contentType, bytes }) => {
        const body = new Uint8Array(bytes);
        for (let i = 0; i < body.length; i += 4096) {
          body[i] = i % 251;
        }
        try {
          const response = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body,
          });
          return {
            ok: response.ok,
            status: response.status,
            etag: response.headers.get("etag"),
            error: response.ok ? null : `HTTP ${response.status}`,
          };
        } catch (error) {
          return {
            ok: false,
            status: 0,
            etag: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      { url: input.url, contentType: input.contentType, bytes: input.bytes },
    );
    return {
      ...result,
      sawPreflight,
      preflightStatus,
      preflightAllowOrigin,
      putExposeHeaders,
      putAllowOrigin,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const bucket = requireEnv("R2_BUCKET");
  const client = createClient();
  const key = `${VIDEO_TEST_PREFIX}${randomUUID()}.bin`;
  const contentType = "application/octet-stream";

  let uploadId: string | undefined;
  let completed = false;

  try {
    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    uploadId = created.UploadId;
    if (!uploadId) {
      throw new Error("CreateMultipartUpload did not return UploadId.");
    }

    const partCommand = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: 1,
      ContentType: contentType,
    } as ConstructorParameters<typeof UploadPartCommand>[0]);
    const signedUrl = await getSignedUrl(client, partCommand, { expiresIn: 900 });

    console.log("Probing browser PUT from", ORIGIN);
    console.log("Object key", key);

    const preflight = await fetch(signedUrl, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const corsHeaders = {
      allowOrigin: preflight.headers.get("access-control-allow-origin"),
      allowMethods: preflight.headers.get("access-control-allow-methods"),
      allowHeaders: preflight.headers.get("access-control-allow-headers"),
      exposeHeaders: preflight.headers.get("access-control-expose-headers"),
    };
    const preflightOk = preflight.status === 200 || preflight.status === 204;
    if (!preflightOk || corsHeaders.allowOrigin !== ORIGIN) {
      throw new Error(
        JSON.stringify(
          {
            ok: false,
            step: "preflight",
            status: preflight.status,
            corsHeaders,
            hint:
              "The private bucket has no CORS policy that allows this origin. Add it in Cloudflare → R2 → shhh-media → Settings → CORS Policy. The signed part PUT itself works from the server; only the browser is blocked.",
          },
          null,
          2,
        ),
      );
    }

    const put = await browserPutPart({
      url: signedUrl,
      contentType,
      bytes: PART_BYTES,
    });

    if (!put.ok) {
      throw new Error(
        JSON.stringify(
          {
            ok: false,
            step: "browser_put",
            status: put.status,
            error: put.error,
            sawPreflight: put.sawPreflight,
            etag: put.etag,
            hint:
              "Add the CORS policy on Cloudflare → R2 → shhh-media → Settings → CORS Policy. AllowedOrigins must include http://localhost:3000 and http://127.0.0.1:3000. ExposeHeaders must include ETag.",
          },
          null,
          2,
        ),
      );
    }

    if (!put.etag) {
      throw new Error(
        JSON.stringify(
          {
            ok: false,
            step: "etag",
            sawPreflight: put.sawPreflight,
            hint: "PUT succeeded but ETag was not readable. ExposeHeaders must include ETag.",
          },
          null,
          2,
        ),
      );
    }

    const listed = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
    const listedPart = listed.Parts?.[0];
    if (!listedPart?.ETag || listedPart.PartNumber !== 1) {
      throw new Error("ListParts did not return the uploaded part.");
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [{ ETag: listedPart.ETag, PartNumber: 1 }],
        },
      }),
    );
    completed = true;

    const downloaded = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: "bytes=0-63",
      }),
    );
    const rangeBytes = await downloaded.Body?.transformToByteArray();
    if (!rangeBytes || rangeBytes.byteLength !== 64) {
      throw new Error("Range GET did not return 64 bytes.");
    }

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    let objectDeleted = false;
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      objectDeleted = true;
    }

    let leftoverMultipartGone = false;
    try {
      await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch {
      leftoverMultipartGone = true;
    }

    if (!leftoverMultipartGone || !objectDeleted) {
      throw new Error(
        JSON.stringify({
          ok: false,
          step: "cleanup",
          leftoverMultipartGone,
          objectDeleted,
        }),
      );
    }

    const digest = createHash("sha256").update(rangeBytes).digest("hex").slice(0, 16);

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: {
            optionsPreflight: preflight.status === 200 || preflight.status === 204,
            allowOrigin: corsHeaders.allowOrigin,
            browserPut: put.ok,
            etagReadable: Boolean(put.etag),
            complete: true,
            cleanedUp: leftoverMultipartGone && objectDeleted,
          },
          bucket,
          key,
          partBytes: PART_BYTES,
          sawPreflight: put.sawPreflight,
          preflightStatus: put.preflightStatus,
          preflightAllowOrigin: put.preflightAllowOrigin,
          putAllowOrigin: put.putAllowOrigin,
          putExposeHeaders: put.putExposeHeaders,
          etag: put.etag,
          rangeGetBytes: rangeBytes.byteLength,
          rangeDigestPrefix: digest,
          leftoverMultipart: leftoverMultipartGone ? "gone" : "unexpected",
          objectDeleted,
          publicAccess: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (uploadId && !completed) {
      await client
        .send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
          }),
        )
        .catch(() => undefined);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
