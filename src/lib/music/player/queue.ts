export type RepeatMode = "none" | "one" | "all";

export type QueueItem = {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  youtubeVideoId: string | null;
  durationMs: number | null;
  clipStartMs?: number | null;
  clipEndMs?: number | null;
  recommendationId?: string | null;
};

export type QueueState = {
  items: QueueItem[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
};

export function createQueue(items: QueueItem[], startIndex = 0): QueueState {
  return {
    items,
    index: Math.min(Math.max(0, startIndex), Math.max(0, items.length - 1)),
    shuffle: false,
    repeat: "none",
  };
}

export function currentItem(state: QueueState): QueueItem | null {
  return state.items[state.index] ?? null;
}

export function nextIndex(state: QueueState): number | null {
  if (state.items.length === 0) return null;
  if (state.repeat === "one") return state.index;
  if (state.index + 1 < state.items.length) return state.index + 1;
  if (state.repeat === "all") return 0;
  return null;
}

export function previousIndex(state: QueueState): number | null {
  if (state.items.length === 0) return null;
  if (state.index > 0) return state.index - 1;
  if (state.repeat === "all") return state.items.length - 1;
  return 0;
}

export function shuffledCopy(items: QueueItem[], keepIndex: number) {
  const current = items[keepIndex];
  const rest = items.filter((_, index) => index !== keepIndex);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  return current ? [current, ...rest] : rest;
}

export function clipBounds(item: QueueItem | null) {
  if (!item) return null;
  if (item.clipStartMs == null || item.clipEndMs == null) return null;
  return { startMs: item.clipStartMs, endMs: item.clipEndMs };
}

export function toQueueItem(
  track: {
    id: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    youtubeVideoId: string | null;
    durationMs: number | null;
  },
  extra: Partial<QueueItem> = {},
): QueueItem {
  return {
    trackId: track.id,
    title: track.title,
    artistName: track.artistName,
    artworkUrl: track.artworkUrl,
    youtubeVideoId: track.youtubeVideoId,
    durationMs: track.durationMs,
    ...extra,
  };
}
