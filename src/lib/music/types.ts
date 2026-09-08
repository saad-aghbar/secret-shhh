export type MusicProvider = "youtube" | "youtube_music" | "spotify" | "apple_music";
export type MusicLibraryScope = "personal" | "shared";
export type MusicRecommendationStatus =
  | "pending"
  | "opened"
  | "listened"
  | "loved"
  | "liked"
  | "not_for_me";
export type MusicActivityKind =
  | "added_library"
  | "added_playlist"
  | "recommended"
  | "loved"
  | "song_of_moment"
  | "memory";

export type MusicSourceDto = {
  id: string;
  provider: MusicProvider;
  externalId: string | null;
  url: string;
  canonicalUrl: string;
};

export type MusicTrackDto = {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string | null;
  albumArtist: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  releaseYear: number | null;
  isrc: string | null;
  youtubeVideoId: string | null;
  youtubePlayable: boolean;
  createdBy: string;
  createdAt: string;
  sources: MusicSourceDto[];
  savedPersonal: boolean;
  savedShared: boolean;
  savedByPartner: boolean;
  favorited: boolean;
  partnerFavorited: boolean;
  lovedByBoth: boolean;
  isSongOfMoment: boolean;
};

export type MusicPlaylistDto = {
  id: string;
  title: string;
  note: string | null;
  ownerId: string;
  collaborative: boolean;
  coverArtworkUrl: string | null;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MusicPlaylistDetailDto = MusicPlaylistDto & {
  tracks: MusicTrackDto[];
};

export type MusicRecommendationDto = {
  id: string;
  track: MusicTrackDto;
  senderId: string;
  recipientId: string;
  note: string | null;
  status: MusicRecommendationStatus;
  createdAt: string;
  openedAt: string | null;
  listenedAt: string | null;
  reactedAt: string | null;
};

export type MusicMemoryDto = {
  id: string;
  trackId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

export type MusicActivityDto = {
  id: string;
  kind: MusicActivityKind;
  actorId: string;
  trackId: string | null;
  trackTitle: string | null;
  playlistId: string | null;
  playlistTitle: string | null;
  createdAt: string;
};

export type MusicSongOfMomentDto = {
  id: string;
  track: MusicTrackDto;
  setBy: string;
  startedAt: string;
  endedAt: string | null;
};

export type MusicAlbumGroupDto = {
  albumTitle: string;
  albumArtist: string | null;
  artworkUrl: string | null;
  tracks: MusicTrackDto[];
};

export type MusicArtistGroupDto = {
  artistName: string;
  tracks: MusicTrackDto[];
};

export type MusicHomeDto = {
  songOfMoment: MusicSongOfMomentDto | null;
  forYou: MusicRecommendationDto[];
  sentByMe: MusicRecommendationDto[];
  ourSongs: MusicTrackDto[];
  recentlyAdded: MusicTrackDto[];
  lovedByBoth: MusicTrackDto[];
  playlists: MusicPlaylistDto[];
  myMusic: MusicTrackDto[];
  partnerMusic: MusicTrackDto[];
  activity: MusicActivityDto[];
};

export type MusicShareDto = {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  durationMs: number | null;
  youtubeVideoId: string | null;
  youtubePlayable: boolean;
  clipStartMs: number | null;
  clipEndMs: number | null;
};

export const MUSIC_PAGE_SIZE = 40;
