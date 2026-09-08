import { durationClose, detectVariantTag, normalizeArtist, normalizeTitle } from "@/lib/music/normalize";

export type CanonicalCandidate = {
  id: string;
  normalizedTitle: string;
  normalizedArtist: string;
  variantTag: string;
  durationMs: number | null;
  isrc: string | null;
  youtubeVideoId: string | null;
  providerIds: Array<{ provider: string; externalId: string }>;
};

export function shouldReuseCanonical(input: {
  title: string;
  artistName: string;
  durationMs: number | null;
  isrc: string | null;
  youtubeVideoId: string | null;
  provider: string;
  externalId: string | null;
  candidates: CanonicalCandidate[];
}): string | null {
  const title = normalizeTitle(input.title);
  const artist = normalizeArtist(input.artistName);
  const variant = detectVariantTag(input.title);

  for (const candidate of input.candidates) {
    if (input.externalId && candidate.providerIds.some((row) => row.provider === input.provider && row.externalId === input.externalId)) {
      return candidate.id;
    }
  }
  if (input.isrc) {
    const hit = input.candidates.find((row) => row.isrc && row.isrc === input.isrc);
    if (hit) return hit.id;
  }
  if (input.youtubeVideoId) {
    const hit = input.candidates.find((row) => row.youtubeVideoId === input.youtubeVideoId);
    if (hit) return hit.id;
  }
  const fuzzy = input.candidates.find((row) => {
    if (row.normalizedTitle !== title || row.normalizedArtist !== artist) return false;
    if (row.variantTag !== variant) return false;
    if (input.durationMs != null && row.durationMs != null && !durationClose(row.durationMs, input.durationMs)) {
      return false;
    }
    return true;
  });
  return fuzzy?.id ?? null;
}
