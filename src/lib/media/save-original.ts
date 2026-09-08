"use client";

/**
 * Save the original file.
 *
 * Web Share Level 2 first, because on iPhone that is what puts a photo in Photos or
 * a voice note in Files; a plain download is the fallback everywhere else. Bytes come
 * from the authenticated same-origin route, never from a signed URL handed to the
 * browser's downloader — the private bucket stays private.
 */

async function blobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch_failed");
  return response.blob();
}

function canShareFiles(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function"
      ? navigator.canShare({ files: [file] })
      : false;
  } catch {
    return false;
  }
}

export async function saveMediaOriginal(input: {
  mediaId: string;
  fallbackFilename: string;
  mimeType: string;
  shareTitle: string;
  /** Optimistic local copy, used instead of a round trip when it exists. */
  localObjectUrl?: string;
}): Promise<void> {
  let blob: Blob;
  let filename = input.fallbackFilename.replace(/[^\w.\-]+/g, "_") || "file";

  if (input.localObjectUrl) {
    blob = await blobFromUrl(input.localObjectUrl);
  } else {
    const response = await fetch(
      `/api/media/${encodeURIComponent(input.mediaId)}/file?variant=original`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("fetch_failed");
    blob = await response.blob();
    const headerName = response.headers
      .get("content-disposition")
      ?.match(/filename="([^"]+)"/)?.[1];
    if (headerName) filename = headerName;
  }

  const file = new File([blob], filename, { type: blob.type || input.mimeType });
  if (canShareFiles(file) && typeof navigator.share === "function") {
    await navigator.share({ files: [file], title: input.shareTitle });
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4_000);
}
