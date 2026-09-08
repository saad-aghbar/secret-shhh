import { randomUUID } from "node:crypto";

import type { DerivativeMime } from "@/lib/media/encode-derivative";

/**
 * Unpredictable object keys. Never use display names or original filenames in paths.
 *
 * media/{conversationId}/{year}/{month}/{mediaUuid}/original
 * media/{conversationId}/{year}/{month}/{mediaUuid}/preview.webp|preview.jpg
 * media/{conversationId}/{year}/{month}/{mediaUuid}/thumb.webp|thumb.jpg
 */
export function buildMediaObjectKey(input: {
  conversationId: string;
  mediaUuid?: string;
  variant: "original" | "preview" | "thumbnail";
  derivativeMime?: DerivativeMime;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const mediaUuid = input.mediaUuid ?? randomUUID();
  const leaf =
    input.variant === "original"
      ? "original"
      : objectKeyLeaf(input.variant, input.derivativeMime ?? "image/webp");
  return `media/${input.conversationId}/${year}/${month}/${mediaUuid}/${leaf}`;
}

function objectKeyLeaf(
  variant: "preview" | "thumbnail",
  derivativeMime: DerivativeMime,
): string {
  const ext = derivativeMime === "image/jpeg" ? "jpg" : "webp";
  return variant === "preview" ? `preview.${ext}` : `thumb.${ext}`;
}

/** Shared mediaUuid folder for original + derivatives of one photo. */
export function mediaFolderPrefix(conversationId: string, mediaUuid: string, now = new Date()) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${conversationId}/${year}/${month}/${mediaUuid}`;
}

export function objectKeyForVariant(
  folderPrefix: string,
  variant: "original" | "preview" | "thumbnail",
  derivativeMime?: DerivativeMime,
) {
  if (variant === "original") return `${folderPrefix}/original`;
  return `${folderPrefix}/${objectKeyLeaf(variant, derivativeMime ?? "image/webp")}`;
}

export const INTEGRATION_TEST_PREFIX = "integration-tests/";
