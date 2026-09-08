import type { ChatMessage, MessageSendStatus, ReplyPreview } from "@/lib/chat/types";

export type PendingPhotoUploadStatus =
  "preparing" | "queued" | "uploading" | "finalizing" | "failed" | "canceled";

export type PendingPhotoAsset = {
  clientAssetId: string;
  mediaFolderId: string;
  sortOrder: number;
  originalFilename: string;
  mimeType: string;
  originalSize: number;
  width?: number;
  height?: number;
  originalUploadId?: string;
  previewUploadId?: string;
  thumbnailUploadId?: string;
  checksum?: string;
  localObjectUrl?: string;
  localThumbUrl?: string;
};

/**
 * Persisted upload metadata. Original File bytes intentionally live only in
 * UploadManager memory, not IndexedDB; a refresh therefore requires reselecting
 * photos before a failed/incomplete upload can be retried.
 */
export type PendingPhotoUpload = {
  kind?: "photo";
  clientGeneratedId: string;
  conversationId: string;
  senderId: string;
  caption: string;
  replyToMessageId?: string;
  replyTo?: ReplyPreview | null;
  status: PendingPhotoUploadStatus;
  progress: number;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  completedUploadIds?: string[];
  assets: PendingPhotoAsset[];
};

export type PendingVideoUpload = {
  kind: "video";
  clientGeneratedId: string;
  conversationId: string;
  senderId: string;
  caption: string;
  replyToMessageId?: string;
  replyTo?: ReplyPreview | null;
  status: PendingPhotoUploadStatus;
  progress: number;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  sessionId?: string;
  clientAssetId: string;
  mediaFolderId: string;
  originalFilename: string;
  mimeType: string;
  totalBytes: number;
  partSize: number;
  totalParts: number;
  fingerprint: string;
  completedParts: number[];
  uploadedBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  previewUploadId?: string;
  thumbnailUploadId?: string;
  needsReselect?: boolean;
  localObjectUrl?: string;
  localPosterUrl?: string;
  posterBlob?: Blob;
  /** Camera recordings have no disk file to reselect after a refresh. */
  origin?: "library" | "camera";
};

/**
 * Voice notes are small enough to persist the recording itself, so an unsent one
 * survives a refresh, a reboot, or a night offline — no reselect, nothing to lose.
 * There is deliberately no caption: a voice message is the message.
 */
export type PendingVoiceUpload = {
  kind: "voice";
  clientGeneratedId: string;
  conversationId: string;
  senderId: string;
  replyToMessageId?: string;
  replyTo?: ReplyPreview | null;
  status: PendingPhotoUploadStatus;
  progress: number;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  clientAssetId: string;
  mediaFolderId: string;
  mimeType: string;
  totalBytes: number;
  durationMs: number;
  waveform: number[];
  uploadId?: string;
  blob?: Blob;
  localObjectUrl?: string;
};

export type PendingUploadJob = PendingPhotoUpload | PendingVideoUpload | PendingVoiceUpload;

export type PhotoUploadSnapshot = {
  jobs: PendingUploadJob[];
  optimisticMessages: ChatMessage[];
};

export type PhotoUploadListener = (snapshot: PhotoUploadSnapshot) => void;

export function isVideoJob(job: PendingUploadJob): job is PendingVideoUpload {
  return job.kind === "video";
}

export function isVoiceJob(job: PendingUploadJob): job is PendingVoiceUpload {
  return job.kind === "voice";
}

/** Rows persisted before Dexie v3 carry no `kind`; they are always photo albums. */
export function isPhotoJob(job: PendingUploadJob): job is PendingPhotoUpload {
  return job.kind === undefined || job.kind === "photo";
}

export function photoStatusToMessageStatus(status: PendingPhotoUploadStatus): MessageSendStatus {
  if (status === "failed" || status === "canceled") return "failed";
  if (status === "queued") return "queued";
  if (status === "preparing") return "preparing";
  return "uploading";
}
