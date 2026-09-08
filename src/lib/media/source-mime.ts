/** Source-file MIME helpers. Stored derivatives may still be JPEG/WebP/PNG. */

export function canonicalizeImageSourceMime(mime: string, fileName = ""): string {
  const raw = mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  if (raw === "image/x-png") return "image/png";
  if (raw === "image/heif" || raw === "image/heic-sequence") return "image/heic";
  if (raw === "image/svg+xml" || raw === "image/svg") return "image/svg+xml";
  if (raw.startsWith("image/")) return raw;
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.jpe?g$/i.test(fileName)) return "image/jpeg";
  if (/\.gif$/i.test(fileName)) return "image/gif";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  if (/\.avif$/i.test(fileName)) return "image/avif";
  if (/\.bmp$/i.test(fileName)) return "image/bmp";
  if (/\.tiff?$/i.test(fileName)) return "image/tiff";
  if (/\.hei[cf]$/i.test(fileName)) return "image/heic";
  return raw;
}

export function isHeicImageSource(mime: string, fileName = ""): boolean {
  const canon = canonicalizeImageSourceMime(mime, fileName);
  return canon === "image/heic" || /\.hei[cf]$/i.test(fileName);
}

export function isRejectedImageSource(mime: string, fileName = ""): boolean {
  const canon = canonicalizeImageSourceMime(mime, fileName);
  return canon === "image/svg+xml" || /\.svg$/i.test(fileName);
}
