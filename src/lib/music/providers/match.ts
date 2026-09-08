import {
  detectVariantTag,
  durationClose,
  isAvoidableYouTubeTitle,
  isPreferredYouTubeChannel,
  normalizeArtist,
  normalizeTitle,
} from "@/lib/music/normalize";
import type { YouTubeSearchHit } from "@/lib/music/providers/types";

export type MatchConfidence = "confident" | "ambiguous" | "none";

export type RankedYouTubeMatch = YouTubeSearchHit & {
  score: number;
  avoidable: boolean;
};

export function rankYouTubeMatches(input: {
  title: string;
  artistName: string;
  durationMs?: number | null;
  hits: YouTubeSearchHit[];
}): { confidence: MatchConfidence; ranked: RankedYouTubeMatch[] } {
  const wantTitle = normalizeTitle(input.title);
  const wantArtist = normalizeArtist(input.artistName);
  const ranked = input.hits
    .map((hit) => {
      const hay = `${hit.title} ${hit.channelTitle}`;
      const hitTitle = normalizeTitle(hit.title);
      const avoidable = isAvoidableYouTubeTitle(hit.title);
      let score = 0;
      if (hitTitle.includes(wantTitle) || wantTitle.includes(hitTitle)) score += 40;
      if (normalizeArtist(hay).includes(wantArtist)) score += 25;
      if (isPreferredYouTubeChannel(hit.channelTitle)) score += 20;
      if (durationClose(hit.durationMs, input.durationMs ?? null)) score += 15;
      if (detectVariantTag(hit.title) !== detectVariantTag(input.title)) score -= 12;
      if (avoidable) score -= 35;
      return { ...hit, score, avoidable };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 45 || top.avoidable) {
    return { confidence: ranked.length ? "ambiguous" : "none", ranked };
  }
  if (second && top.score - second.score < 12) {
    return { confidence: "ambiguous", ranked };
  }
  return { confidence: "confident", ranked };
}
