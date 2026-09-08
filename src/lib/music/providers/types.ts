export type MusicProvider = "youtube" | "youtube_music" | "spotify" | "apple_music";

export type ResolvedMetadata = {
  provider: MusicProvider;
  externalId: string | null;
  url: string;
  canonicalUrl: string;
  title: string;
  artistName: string;
  albumTitle: string | null;
  albumArtist: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  releaseYear: number | null;
  isrc: string | null;
  youtubeVideoId: string | null;
};

export type YouTubeSearchHit = {
  videoId: string;
  title: string;
  channelTitle: string;
  durationMs: number | null;
  artworkUrl: string | null;
};

export type ResolvePreview = {
  metadata: ResolvedMetadata;
  existingTrackId: string | null;
  match: {
    confidence: "confident" | "ambiguous" | "none";
    candidates: YouTubeSearchHit[];
    selectedVideoId: string | null;
  };
};
