import type { MusicActivityKind, MusicRecommendationStatus } from "@/lib/music/types";

export function displayArtistName(name: string | null | undefined) {
  if (!name?.trim() || name.trim() === "Unknown artist") return "";
  return name.trim();
}

export function canEditPlaylist(playlist: { ownerId: string; collaborative: boolean }, userId: string) {
  return playlist.collaborative || playlist.ownerId === userId;
}

export function playlistOwnershipCopy(input: {
  collaborative: boolean;
  ownerId: string;
  viewerId: string;
  viewerName: string;
  partnerName: string;
}) {
  if (input.collaborative) return "Ours";
  return input.ownerId === input.viewerId ? `${input.viewerName}’s playlist` : `${input.partnerName}’s playlist`;
}

export function recommendationStatusCopy(status: MusicRecommendationStatus, sentByMe: boolean) {
  if (status === "pending") return sentByMe ? "Hasn’t opened it yet" : "Not listened yet";
  if (status === "opened") return sentByMe ? "Opened" : "Opened";
  if (status === "listened") return "Listened";
  if (status === "loved") return "Loved ♡";
  if (status === "liked") return "Liked";
  return sentByMe ? "Not for them" : "Not for me";
}

export function recommendationGiftCopy(partnerName: string, sentByMe: boolean) {
  return sentByMe ? `You sent this for ${partnerName}` : `${partnerName} sent this for you`;
}

export function recommendationProgressMark(status: MusicRecommendationStatus) {
  if (status === "loved") return "♡";
  if (status === "listened" || status === "liked") return "✓";
  if (status === "not_for_me") return "–";
  return "○";
}

export function activityKindCopy(kind: MusicActivityKind) {
  if (kind === "added_library") return "added a song";
  if (kind === "added_playlist") return "added to a playlist";
  if (kind === "recommended") return "recommended a song";
  if (kind === "loved") return "loved a song";
  if (kind === "song_of_moment") return "set our song right now";
  return "left a memory";
}

export function relativeDayLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diff = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function lovedByBoth(favorited: boolean, partnerFavorited: boolean) {
  return favorited && partnerFavorited;
}

export function sourceLabel(provider: string) {
  if (provider === "spotify") return "Spotify";
  if (provider === "apple_music") return "Apple Music";
  if (provider === "youtube_music") return "YouTube Music";
  return "YouTube";
}
