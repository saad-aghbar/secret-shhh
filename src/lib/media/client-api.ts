"use client";

import type { ChatMessage } from "@/lib/chat/types";
import { mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import type { ApiErrorBody } from "@/types/api";

export type UploadVariant = "original" | "preview" | "thumbnail";
export type MediaUrlVariant = "thumb" | "preview" | "original";

export type InitUploadInput = {
  clientGeneratedId: string;
  clientAssetId: string;
  variant: UploadVariant;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  checksum?: string;
  mediaFolderId: string;
};

export type FinalizePhotoAsset = {
  clientAssetId: string;
  sortOrder: number;
  originalUploadId: string;
  previewUploadId: string;
  thumbnailUploadId: string;
  width: number;
  height: number;
  mimeType: string;
  originalFilename: string;
  checksum?: string;
};

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T | Partial<ApiErrorBody>;
  if (!response.ok) {
    const raw = (body as Partial<ApiErrorBody>).message || "Photo request failed.";
    throw new Error(mapMediaErrorToConsumer(raw));
  }
  return body as T;
}

export async function apiInitMediaUpload(input: InitUploadInput) {
  return parse<{
    uploadId: string;
    upload: {
      url: string;
      method: string;
      headers: Record<string, string>;
      expiresAt: string;
    };
  }>(
    await fetch("/api/media/uploads/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export function uploadBlobWithProgress(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  blob: Blob;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(input.method ?? "PUT", input.url);
    for (const [name, value] of Object.entries(input.headers ?? {})) {
      // Browsers forbid setting Content-Length; the runtime sets it from the body.
      if (name.toLowerCase() === "content-length") continue;
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      input.onProgress?.(event.loaded, event.lengthComputable ? event.total : input.blob.size);
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted."));
    xhr.onabort = () => reject(new DOMException("Upload canceled", "AbortError"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ etag: xhr.getResponseHeader("etag") });
        return;
      }
      reject(new Error(`Photo storage returned ${xhr.status}.`));
    };
    const abort = () => xhr.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => input.signal?.removeEventListener("abort", abort);
    xhr.send(input.blob);
  });
}

export async function apiCompleteMediaUpload(uploadId: string, checksum?: string) {
  return parse<{ uploadId: string; status: string }>(
    await fetch(`/api/media/uploads/${encodeURIComponent(uploadId)}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(checksum ? { checksum } : {}),
    }),
  );
}

export async function apiCancelMediaUpload(uploadId: string) {
  return parse<{ uploadId: string; status: string }>(
    await fetch(`/api/media/uploads/${encodeURIComponent(uploadId)}/cancel`, {
      method: "POST",
    }),
  );
}

export async function apiFinalizePhotoMessage(input: {
  clientGeneratedId: string;
  caption?: string;
  replyToMessageId?: string;
  assets: FinalizePhotoAsset[];
}) {
  return parse<{ message: ChatMessage }>(
    await fetch("/api/media/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiGetMediaUrl(mediaId: string, variant: MediaUrlVariant, download = false) {
  const query = new URLSearchParams({
    variant,
    download: download ? "1" : "0",
  });
  return parse<{ url: string; expiresAt: string; variant: MediaUrlVariant; mediaId: string }>(
    await fetch(`/api/media/${encodeURIComponent(mediaId)}/url?${query}`, {
      cache: "no-store",
    }),
  );
}

export type SharedMediaItemDto = {
  id: string;
  messageId: string;
  sortOrder: number;
  mimeType: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  durationMs?: number | null;
  originalSizeBytes: number;
  previewSizeBytes: number | null;
  originalFilename: string | null;
  uploadStatus: string;
  hasPreview: boolean;
  hasThumbnail: boolean;
  senderId: string;
  caption: string | null;
  createdAt: string;
  messageAttachmentCount: number;
  favoritedBy: string[];
};

export type SharedMediaQuery = {
  cursor?: string;
  limit?: number;
  senderId?: string | null;
  from?: string | null;
  to?: string | null;
  favorites?: "any" | "mine" | "both";
  sort?: "newest" | "oldest";
  mediaType?: "all" | "image" | "video";
};

export async function apiListSharedMedia(input?: SharedMediaQuery) {
  const query = new URLSearchParams();
  if (input?.cursor) query.set("cursor", input.cursor);
  if (input?.limit) query.set("limit", String(input.limit));
  if (input?.senderId) query.set("sender", input.senderId);
  if (input?.from) query.set("from", input.from);
  if (input?.to) query.set("to", input.to);
  if (input?.favorites && input.favorites !== "any") query.set("favorites", input.favorites);
  if (input?.sort && input.sort !== "newest") query.set("sort", input.sort);
  if (input?.mediaType && input.mediaType !== "all") query.set("type", input.mediaType);
  // Local calendar days: the server resolves range bounds in the viewer's zone.
  const tz = resolveTimeZone();
  if (tz) query.set("tz", tz);
  const suffix = query.size ? `?${query}` : "";
  return parse<{ items: SharedMediaItemDto[]; nextCursor: string | null }>(
    await fetch(`/api/media/shared${suffix}`, { cache: "no-store" }),
  );
}

function resolveTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export async function apiGetMessageAttachments(messageId: string) {
  return parse<{ messageId: string; media: import("@/lib/chat/types").ChatMediaItem[] }>(
    await fetch(`/api/media/messages/${encodeURIComponent(messageId)}/attachments`, {
      cache: "no-store",
    }),
  );
}

/* Albums */

export type AlbumCoverDto = {
  mediaId: string;
  hasPreview: boolean;
  hasThumbnail: boolean;
  width: number | null;
  height: number | null;
  mediaType?: "image" | "video";
};

export type AlbumSummaryDto = {
  id: string;
  title: string;
  note: string | null;
  itemCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cover: AlbumCoverDto | null;
};

export type AlbumDetailDto = AlbumSummaryDto & {
  coverMediaId: string | null;
  items: SharedMediaItemDto[];
};

export async function apiListAlbums() {
  return parse<{ albums: AlbumSummaryDto[] }>(
    await fetch("/api/media/albums", { cache: "no-store" }),
  );
}

export async function apiGetAlbum(albumId: string) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}`, { cache: "no-store" }),
  );
}

export async function apiCreateAlbum(input: {
  title: string;
  note?: string | null;
  mediaIds?: string[];
}) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch("/api/media/albums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiUpdateAlbum(
  albumId: string,
  input: { title?: string; note?: string | null; coverMediaId?: string | null },
) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiDeleteAlbum(albumId: string) {
  return parse<{ albumId: string }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}`, { method: "DELETE" }),
  );
}

export async function apiAddAlbumItems(albumId: string, mediaIds: string[]) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaIds }),
    }),
  );
}

/** Membership only — the photo stays in chat and in All media. */
export async function apiRemoveAlbumItems(albumId: string, mediaIds: string[]) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}/items`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaIds }),
    }),
  );
}

export async function apiReorderAlbumItems(albumId: string, mediaIds: string[]) {
  return parse<{ album: AlbumDetailDto }>(
    await fetch(`/api/media/albums/${encodeURIComponent(albumId)}/items/order`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaIds }),
    }),
  );
}

export async function apiSetMediaFavorite(mediaId: string, favorite: boolean) {
  return parse<{ mediaId: string; favoritedBy: string[] }>(
    await fetch(`/api/media/${encodeURIComponent(mediaId)}/favorite`, {
      method: favorite ? "PUT" : "DELETE",
    }),
  );
}

export async function apiInitVideoUpload(input: {
  clientGeneratedId: string;
  clientAssetId: string;
  mediaFolderId: string;
  filename: string;
  mimeType: string;
  size: number;
  fingerprint: string;
  durationMs?: number;
  width?: number;
  height?: number;
}) {
  return parse<{
    sessionId: string;
    partSize: number;
    totalParts: number;
    totalBytes: number;
    expiresAt: string;
  }>(
    await fetch("/api/media/video/uploads/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiSignVideoParts(sessionId: string, partNumbers: number[]) {
  return parse<{
    sessionId: string;
    parts: Array<{
      partNumber: number;
      upload: {
        url: string;
        method: string;
        headers: Record<string, string>;
        expiresAt: string;
      };
    }>;
  }>(
    await fetch(`/api/media/video/uploads/${encodeURIComponent(sessionId)}/parts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partNumbers }),
    }),
  );
}

export async function apiRecordVideoPart(
  sessionId: string,
  partNumber: number,
  input: { etag: string; sizeBytes: number },
) {
  return parse<{ sessionId: string; partNumber: number }>(
    await fetch(`/api/media/video/uploads/${encodeURIComponent(sessionId)}/parts/${partNumber}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiGetVideoUploadSession(sessionId: string) {
  return parse<{
    sessionId: string;
    status: string;
    partSize: number;
    totalParts: number;
    totalBytes: number;
    fingerprint: string;
    completedParts: Array<{ partNumber: number; etag: string; sizeBytes: number | null }>;
    uploadedBytes: number;
    providerAlive: boolean;
    expiresAt: string;
  }>(
    await fetch(`/api/media/video/uploads/${encodeURIComponent(sessionId)}`, {
      cache: "no-store",
    }),
  );
}

export async function apiCompleteVideoUpload(
  sessionId: string,
  input: {
    caption?: string;
    previewUploadId?: string;
    thumbnailUploadId?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    replyToMessageId?: string;
  },
) {
  return parse<{ message: ChatMessage }>(
    await fetch(`/api/media/video/uploads/${encodeURIComponent(sessionId)}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiInitVoiceUpload(input: {
  clientGeneratedId: string;
  clientAssetId: string;
  mediaFolderId: string;
  mimeType: string;
  size: number;
  durationMs: number;
}) {
  return parse<{
    uploadId: string;
    /** Null when an earlier attempt already uploaded the bytes — finalize directly. */
    upload: {
      url: string;
      method: string;
      headers: Record<string, string>;
      expiresAt: string;
    } | null;
  }>(
    await fetch("/api/media/voice/uploads/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiFinalizeVoiceMessage(input: {
  clientGeneratedId: string;
  uploadId: string;
  durationMs: number;
  waveform: number[];
  replyToMessageId?: string;
}) {
  return parse<{ message: ChatMessage }>(
    await fetch("/api/media/voice/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function apiCancelVideoUpload(sessionId: string) {
  return parse<{ sessionId: string; status: string }>(
    await fetch(`/api/media/video/uploads/${encodeURIComponent(sessionId)}/cancel`, {
      method: "POST",
    }),
  );
}
