import type { MusicPlaylistDto, MusicRecommendationDto, MusicTrackDto } from "@/lib/music/types";

export type PendingMusicKind = "favorite" | "library" | "memory";

export type PendingMusicMutation = {
  id: string;
  kind: PendingMusicKind;
  trackId: string;
  favorited?: boolean;
  scope?: "personal" | "shared";
  saved?: boolean;
  text?: string;
  clientGeneratedId?: string;
  status: "queued" | "sending" | "failed";
  createdAt: string;
};

export type CachedMusicTrack = MusicTrackDto & { updatedAt: string };
export type CachedMusicPlaylist = MusicPlaylistDto & { updatedAt: string };
export type CachedMusicRecommendation = MusicRecommendationDto & { updatedAt: string };
