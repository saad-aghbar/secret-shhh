/**
 * Verifies R2 Content-Type headers and magic bytes match for image media variants.
 * Run with: set -a && source .env.local && set +a && pnpm exec tsx scripts/verify-r2-media-content-types.ts
 */
import { desc, eq } from "drizzle-orm";

import { getDb } from "../src/lib/db";
import { messageMedia, messages } from "../src/lib/db/schema";
import { sniffImageMime } from "../src/lib/media/validation";
import { getStorageProvider, getStorageProviderName, resetStorageProviderCache } from "../src/lib/storage";

type VariantCheck = {
  label: "original" | "preview" | "thumbnail";
  key: string;
  expectedContentType?: string;
};

function expectedExtension(mime: string | undefined): string | null {
  if (!mime) return null;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return null;
}

function assertKeySuffix(key: string, mime: string | undefined) {
  if (key.endsWith("/original")) return;
  const ext = expectedExtension(mime);
  if (!ext) return;
  if (!key.endsWith(`.${ext}`)) {
    throw new Error(`Key suffix mismatch for ${key}: expected .${ext} for ${mime}`);
  }
}

function assertContentTypeMatchesBytes(contentType: string | undefined, bytes: Uint8Array) {
  const sniffed = sniffImageMime(bytes);
  const normalized = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (!sniffed || !normalized) {
    throw new Error(`Could not verify Content-Type ${contentType ?? "missing"} against bytes`);
  }
  if (sniffed !== normalized) {
    throw new Error(
      `Content-Type ${normalized} does not match magic bytes (${sniffed}) — possible JPEG-as-WebP leak`,
    );
  }
}

async function auditVariant(provider: ReturnType<typeof getStorageProvider>, check: VariantCheck) {
  const head = await provider.headObject(check.key);
  if (!head) throw new Error(`Missing R2 object: ${check.key}`);

  const getBytes = provider.getObjectBytes;
  if (!getBytes) throw new Error("Storage provider missing getObjectBytes");
  const bytes = await getBytes(check.key);
  if (!bytes?.length) throw new Error(`Empty R2 object: ${check.key}`);

  const contentType = head.contentType?.split(";")[0]?.trim().toLowerCase();
  assertKeySuffix(check.key, contentType);
  assertContentTypeMatchesBytes(contentType, bytes.slice(0, 16));

  if (check.expectedContentType && contentType !== check.expectedContentType) {
    throw new Error(
      `Expected ${check.expectedContentType} for ${check.label}, got ${contentType ?? "missing"}`,
    );
  }

  return {
    label: check.label,
    key: check.key,
    contentType,
    sniffed: sniffImageMime(bytes.slice(0, 16)),
    size: head.size,
  };
}

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
      mimeType: messageMedia.mimeType,
      storageKey: messageMedia.storageKey,
      previewKey: messageMedia.previewStorageKey,
      thumbKey: messageMedia.thumbnailStorageKey,
      createdAt: messageMedia.createdAt,
    })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(eq(messages.type, "image"))
    .orderBy(desc(messageMedia.createdAt))
    .limit(1);

  if (rows.length === 0) {
    console.log(JSON.stringify({ provider: name, imageMediaRows: 0, note: "no image media yet" }));
    return;
  }

  const row = rows[0]!;
  if (!row.previewKey || !row.thumbKey) {
    throw new Error(`Missing preview/thumb keys for ${row.mediaId}`);
  }

  const checks: VariantCheck[] = [
    {
      label: "original",
      key: row.storageKey,
      expectedContentType: row.mimeType?.split(";")[0]?.trim().toLowerCase(),
    },
    { label: "preview", key: row.previewKey },
    { label: "thumbnail", key: row.thumbKey },
  ];

  const results = [];
  for (const check of checks) {
    results.push(await auditVariant(provider, check));
  }

  console.log(
    JSON.stringify(
      {
        provider: name,
        mediaId: row.mediaId,
        originalMime: row.mimeType,
        variants: results,
        contentTypeMatchesBytes: true,
        keySuffixMatchesMime: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
