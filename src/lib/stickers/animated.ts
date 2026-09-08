/**
 * Byte-level animated-source detection.
 * GIF is treated as animated (header). Animated WebP is the RIFF ANIM chunk.
 */
export function isGifBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

export function isWebpBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/** True when a WebP bitstream contains an ANIM chunk (animated, not still). */
export function isAnimatedWebpBytes(bytes: Uint8Array): boolean {
  if (!isWebpBytes(bytes) || bytes.length < 20) {
    return false;
  }
  // RIFF chunks after the 12-byte header. ANIM lives as a top-level WebP chunk.
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    );
    const size =
      bytes[offset + 4]! |
      (bytes[offset + 5]! << 8) |
      (bytes[offset + 6]! << 16) |
      (bytes[offset + 7]! << 24);
    if (fourcc === "ANIM") {
      return true;
    }
    const padded = size + (size % 2);
    if (padded < 0 || offset + 8 + padded <= offset) {
      break;
    }
    offset += 8 + padded;
  }
  return false;
}

export function isAnimatedStickerSource(bytes: Uint8Array): boolean {
  return isGifBytes(bytes) || isAnimatedWebpBytes(bytes);
}
