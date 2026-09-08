import type { CallEventMeta } from "@/lib/calls/events";

export const MESSAGE_PAGE_SIZE = 50;
export const MESSAGE_PAGE_MAX = 100;
export const RECEIPT_BATCH_MAX = 100;
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type ChatMessageType = "text" | "image" | "video" | "audio" | "sticker" | "doodle" | "call" | "music";

export type DoodleRef = {
  id: string;
  version: number;
  aspectRatio: number;
  backgroundMode: "paper";
  document: import("@/lib/doodles/document").DoodleDocument;
};

export type StickerRef = {
  id: string;
  name: string | null;
  animated: boolean;
  width: number;
  height: number;
  archived: boolean;
  creatorId?: string;
  saved?: boolean;
};

export type ChatMediaItem = {
  id: string;
  sortOrder: number;
  mimeType: string;
  mediaType?: "image" | "video" | "audio";
  width: number | null;
  height: number | null;
  durationMs?: number | null;
  /** Voice only: stored 0–100 amplitude buckets, resampled to fit at render time. */
  waveform?: number[];
  originalSizeBytes: number;
  previewSizeBytes: number | null;
  originalFilename: string | null;
  uploadStatus: string;
  hasPreview: boolean;
  hasThumbnail: boolean;
  /** Local-only optimistic preview (object URL). Never from server. */
  localObjectUrl?: string;
  localThumbUrl?: string;
  needsReselect?: boolean;
  /** How the clip was created. Camera recordings cannot be reselected after a refresh. */
  origin?: "library" | "camera";
};

/** One-level reply reference. Never nested. */
export type ReplyPreview = {
  id: string;
  senderId: string;
  type: ChatMessageType;
  textSnippet: string | null;
  mediaPreviewId: string | null;
  durationMs: number | null;
  sticker?: StickerRef | null;
  doodle?: DoodleRef | null;
  music?: MusicShareRef | null;
  deleted: boolean;
};

export type MusicShareRef = {
  trackId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  durationMs: number | null;
  youtubeVideoId: string | null;
  youtubePlayable: boolean;
  clipStartMs: number | null;
  clipEndMs: number | null;
  savedPersonal?: boolean;
  savedShared?: boolean;
};

/** Compact per-user reaction. At most one row per person. */
export type MessageReaction = {
  userId: string;
  emoji: string;
  createdAt: string;
};

/** Server-authoritative message as seen by a specific viewer. */
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientGeneratedId: string;
  type: ChatMessageType;
  textContent: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  replyTo?: ReplyPreview | null;
  reactions?: MessageReaction[];
  media?: ChatMediaItem[];
  sticker?: StickerRef;
  doodle?: DoodleRef;
  call?: CallEventMeta;
  music?: MusicShareRef;
  /** Upload progress 0–100 while sending photos (local only). */
  uploadProgress?: number;
  /** Warm local-only failure copy while a photo send is retryable. */
  uploadError?: string;
};

export type MessageSendStatus =
  | "preparing"
  | "queued"
  | "sending"
  | "uploading"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type MessagePage = {
  messages: ChatMessage[];
  nextBeforeCursor: string | null;
  oldestId: string | null;
  newestId: string | null;
};

export type BubbleGroup = "single" | "first" | "middle" | "last";
