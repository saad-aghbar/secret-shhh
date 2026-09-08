/**
 * Opt-in real R2 smoke test.
 *
 * Usage:
 *   STORAGE_PROVIDER=r2 pnpm exec tsx scripts/r2-smoke.ts
 *
 * Requires R2_* env vars. Uploads under integration-tests/, verifies bytes, deletes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

import { INTEGRATION_TEST_PREFIX } from "../src/lib/storage/object-keys";
import { createR2StorageProvider } from "../src/lib/storage/r2";

function applyEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  applyEnvLocal();
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
  ] as const;
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key}. Configure private R2 credentials first.`);
      process.exit(1);
    }
  }

  const storage = createR2StorageProvider({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    endpoint: process.env.R2_ENDPOINT!,
  });

  const key = `${INTEGRATION_TEST_PREFIX}${randomUUID()}.bin`;
  const body = new Uint8Array(createHash("sha256").update(`shhh-r2-smoke-${Date.now()}`).digest());
  const checksum = createHash("sha256").update(body).digest("hex");

  console.log("Putting", key);
  await storage.putObject!({
    key,
    body,
    contentType: "application/octet-stream",
    contentLength: body.byteLength,
  });

  const meta = await storage.headObject(key);
  if (!meta || meta.size !== body.byteLength) {
    throw new Error("headObject size mismatch");
  }

  const downloaded = await storage.getObjectBytes!(key);
  if (!downloaded) throw new Error("missing download");
  const downloadedChecksum = createHash("sha256").update(downloaded).digest("hex");
  if (downloadedChecksum !== checksum) {
    throw new Error("checksum mismatch — original not preserved");
  }

  const signed = await storage.createSignedDownloadUrl({ key, expiresInSeconds: 60 });
  if (!signed.url.startsWith("http")) throw new Error("bad signed url");

  await storage.deleteObject(key);
  const gone = await storage.headObject(key);
  if (gone) throw new Error("object still present after delete");

  console.log("R2 smoke OK", { bytes: body.byteLength, checksum });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
