export const musicKeys = {
  all: ["music"] as const,
  home: () => [...musicKeys.all, "home"] as const,
  track: (id: string) => [...musicKeys.all, "track", id] as const,
  playlist: (id: string) => [...musicKeys.all, "playlist", id] as const,
  albums: () => [...musicKeys.all, "albums"] as const,
  artists: () => [...musicKeys.all, "artists"] as const,
  search: (q: string) => [...musicKeys.all, "search", q] as const,
  songHistory: () => [...musicKeys.all, "song-history"] as const,
};
