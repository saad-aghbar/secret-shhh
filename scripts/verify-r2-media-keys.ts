/**
 * Verifies DB stores R2 object keys (not public URLs) for recent image media.
 * Run with: set -a && source .env.local && set +a && pnpm exec tsx scripts/verify-r2-media-keys.ts
 */
import { desc, eq } from "drizzle-orm";

import { getDb } from "../src/lib/db";
import { messageMedia, messages } from "../src/lib/db/schema";
import { getStorageProvider, getStorageProviderName, resetStorageProviderCache } from "../src/lib/storage";

async function main() {
  resetStorageProviderCache();
  const name = getStorageProviderName();
  const provider = getStorageProvider();
  if (name !== "r2" || provider.name !== "r2") {
    throw new Error(`Expected r2 provider, got ${name}/${provider.name}`);
  }

  const db = getDb();
  const rows = await db
    .select({
      mediaId: messageMedia.id,
      storageKey: messageMedia.storageKey,
      previewKey: messageMedia.previewStorageKey,
      thumbKey: messageMedia.thumbnailStorageKey,
      type: messages.type,
    })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(eq(messages.type, "image"))
    .orderBy(desc(messageMedia.createdAt))
    .limit(5);

  if (rows.length === 0) {
    console.log(JSON.stringify({ provider: name, imageMediaRows: 0, note: "no image media yet" }));
    return;
  }

  for (const row of rows) {
    for (const key of [row.storageKey, row.previewKey, row.thumbKey]) {
      if (!key) continue;
      if (key.startsWith("http://") || key.startsWith("https://")) {
        throw new Error(`DB stores URL instead of key: ${key.slice(0, 40)}…`);
      }
      if (key.includes("r2.cloudflarestorage.com") || key.includes("r2.dev")) {
        throw new Error("DB appears to store public R2 URL");
      }
      if (!key.startsWith("media/")) {
        throw new Error(`Unexpected key prefix: ${key.slice(0, 40)}`);
      }
    }
    if (!row.previewKey || !row.thumbKey) {
      throw new Error(`Missing preview/thumb keys for ${row.mediaId}`);
    }
    // Prove original + preview + thumb exist in private bucket via authenticated head
    for (const key of [row.storageKey, row.previewKey, row.thumbKey]) {
      const head = await provider.headObject(key!);
      if (!head) throw new Error(`Missing R2 object for ${row.mediaId}: ${key}`);
    }
  }

  console.log(
    JSON.stringify({
      provider: name,
      checked: rows.length,
      keysArePrivatePaths: true,
      objectsExistInR2: true,
      variantsChecked: ["original", "preview", "thumbnail"],
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
