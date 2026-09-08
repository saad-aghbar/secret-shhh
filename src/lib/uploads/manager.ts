"use client";

import type { ChatMediaItem, ChatMessage } from "@/lib/chat/types";
import { connectionManager, type ConnectionState } from "@/lib/connection/manager";
import {
  apiCancelMediaUpload,
  apiCancelVideoUpload,
  apiCompleteMediaUpload,
  apiCompleteVideoUpload,
  apiFinalizePhotoMessage,
  apiFinalizeVoiceMessage,
  apiGetVideoUploadSession,
  apiInitMediaUpload,
  apiInitVideoUpload,
  apiInitVoiceUpload,
  uploadBlobWithProgress,
  type UploadVariant,
} from "@/lib/media/client-api";
import { sha256Hex } from "@/lib/media/checksum";
import {
  CONSUMER_AUDIO_ERRORS,
  CONSUMER_VIDEO_ERRORS,
  mapMediaErrorToConsumer,
} from "@/lib/media/consumer-errors";
import { derivativeFilenameStem } from "@/lib/media/encode-derivative";
import {
  createImageDerivatives,
  processImagesOneAtATime,
  type ImageDerivatives,
} from "@/lib/media/derivatives";
import { resolveOriginalFileMime, resolveOriginalVideoMime } from "@/lib/media/validation";
import { videoResumeFingerprint } from "@/lib/media/video-fingerprint";
import { createVideoPoster } from "@/lib/media/video-poster";
import { getChatDb } from "@/lib/sync/db";
import type {
  PendingPhotoAsset,
  PendingPhotoUpload,
  PendingUploadJob,
  PendingVideoUpload,
  PendingVoiceUpload,
  PhotoUploadListener,
  PhotoUploadSnapshot,
} from "@/lib/uploads/types";
import { isVideoJob, isVoiceJob } from "@/lib/uploads/types";
import { uploadMissingVideoParts, VideoUploadPausedError } from "@/lib/uploads/video-parts";

const MAX_PHOTOS = 10;

type PreparedAsset = {
  meta: PendingPhotoAsset;
  derivatives: ImageDerivatives;
};

function videoProgress(job: PendingVideoUpload) {
  if (job.totalBytes < 1) return 0;
  return Math.min(97, Math.round((job.uploadedBytes / job.totalBytes) * 97));
}

class UploadManager {
  private jobs = new Map<string, PendingUploadJob>();
  private files = new Map<string, File[]>();
  private videoFiles = new Map<string, File>();
  private finalized = new Map<string, ChatMessage>();
  private controllers = new Map<string, AbortController>();
  private pauseReasons = new Map<string, "pause" | "cancel">();
  private listeners = new Set<PhotoUploadListener>();
  private running = new Set<string>();
  private connection: ConnectionState = connectionManager.getState();
  private hydrateTask: Promise<void> | null = null;
  private lastProgressEmit = 0;
  private callActive = false;

  constructor() {
    if (typeof window !== "undefined") {
      connectionManager.subscribe((state) => {
        this.connection = state;
        if (state === "offline") {
          for (const job of this.jobs.values()) {
            if (!isVideoJob(job) && !isVoiceJob(job)) continue;
            if (
              job.status === "uploading" ||
              job.status === "preparing" ||
              job.status === "finalizing"
            ) {
              this.pauseReasons.set(job.clientGeneratedId, "pause");
              this.controllers.get(job.clientGeneratedId)?.abort();
            }
          }
        }
        this.pump();
        this.emit();
      });
      void this.hydrate();
    }
  }

  subscribe(listener: PhotoUploadListener) {
    this.listeners.add(listener);
    void this.hydrate().then(() => listener(this.snapshot()));
    return () => {
      this.listeners.delete(listener);
    };
  }

  getOptimisticMessages(conversationId?: string) {
    const active = [...this.jobs.values()]
      .filter((job) => job.status !== "canceled")
      .filter((job) => !conversationId || job.conversationId === conversationId)
      .map((job) => this.toOptimistic(job));
    const completed = [...this.finalized.values()].filter(
      (message) => !conversationId || message.conversationId === conversationId,
    );
    return [...active, ...completed];
  }

  /** Messages that finished finalize and still need to be merged into the thread cache. */
  takeFinalized(conversationId?: string): ChatMessage[] {
    const ready = [...this.finalized.entries()].filter(
      ([, message]) => !conversationId || message.conversationId === conversationId,
    );
    for (const [clientGeneratedId] of ready) {
      this.finalized.delete(clientGeneratedId);
    }
    return ready.map(([, message]) => message);
  }

  /** Quiet diagnostics for More settings — no storage keys or signed URLs. */
  getDiagnostics() {
    const jobs = [...this.jobs.values()].filter((job) => job.status !== "canceled");
    return {
      pendingUploads: jobs.filter((job) => job.status === "queued" || job.status === "failed")
        .length,
      activeUploads: jobs.filter(
        (job) =>
          job.status === "preparing" || job.status === "uploading" || job.status === "finalizing",
      ).length,
      connection: this.connection,
    };
  }

  async enqueueAlbum(input: {
    files: File[];
    caption?: string;
    clientGeneratedId?: string;
    conversationId: string;
    senderId: string;
    replyToMessageId?: string;
    replyTo?: ChatMessage["replyTo"];
  }) {
    if (input.files.length < 1) throw new Error("Choose at least one photo.");
    if (input.files.length > MAX_PHOTOS) throw new Error("You can send up to 10 photos at once.");

    const clientGeneratedId = input.clientGeneratedId ?? crypto.randomUUID();
    const assets = input.files.map<PendingPhotoAsset>((file, sortOrder) => ({
      clientAssetId: crypto.randomUUID(),
      mediaFolderId: crypto.randomUUID(),
      sortOrder,
      originalFilename: file.name || `photo-${sortOrder + 1}`,
      mimeType: file.type || "application/octet-stream",
      originalSize: file.size,
      localObjectUrl: URL.createObjectURL(file),
    }));
    const job: PendingPhotoUpload = {
      kind: "photo",
      clientGeneratedId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      caption: input.caption?.trim() ?? "",
      replyToMessageId: input.replyToMessageId,
      replyTo: input.replyTo,
      status: this.connection === "offline" ? "queued" : "preparing",
      progress: 0,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      assets,
      completedUploadIds: [],
    };
    this.jobs.set(clientGeneratedId, job);
    this.files.set(clientGeneratedId, [...input.files]);
    await this.persist(job);
    this.emit();
    this.pump();
    return clientGeneratedId;
  }

  async enqueueVideo(input: {
    file: File;
    caption?: string;
    clientGeneratedId?: string;
    conversationId: string;
    senderId: string;
    origin?: "library" | "camera";
    replyToMessageId?: string;
    replyTo?: ChatMessage["replyTo"];
  }) {
    const clientGeneratedId = input.clientGeneratedId ?? crypto.randomUUID();
    const job: PendingVideoUpload = {
      kind: "video",
      clientGeneratedId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      caption: input.caption?.trim() ?? "",
      replyToMessageId: input.replyToMessageId,
      replyTo: input.replyTo,
      status: this.connection === "offline" ? "queued" : "preparing",
      progress: 0,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      clientAssetId: crypto.randomUUID(),
      mediaFolderId: crypto.randomUUID(),
      originalFilename: input.file.name || "video",
      mimeType: input.file.type || "application/octet-stream",
      totalBytes: input.file.size,
      partSize: 0,
      totalParts: 0,
      fingerprint: "",
      completedParts: [],
      uploadedBytes: 0,
      origin: input.origin,
    };
    this.jobs.set(clientGeneratedId, job);
    this.videoFiles.set(clientGeneratedId, input.file);
    await this.persist(job);
    this.emit();
    this.pump();
    return clientGeneratedId;
  }

  /**
   * A voice note carries its own recording, so the queue can resume it after a
   * refresh without asking the person to record again.
   */
  async enqueueVoice(input: {
    file: File;
    durationMs: number;
    waveform: number[];
    clientGeneratedId?: string;
    conversationId: string;
    senderId: string;
    replyToMessageId?: string;
    replyTo?: ChatMessage["replyTo"];
  }) {
    const clientGeneratedId = input.clientGeneratedId ?? crypto.randomUUID();
    const job: PendingVoiceUpload = {
      kind: "voice",
      clientGeneratedId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      replyToMessageId: input.replyToMessageId,
      replyTo: input.replyTo,
      status: this.connection === "offline" ? "queued" : "preparing",
      progress: 0,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      clientAssetId: crypto.randomUUID(),
      mediaFolderId: crypto.randomUUID(),
      mimeType: input.file.type || "audio/webm",
      totalBytes: input.file.size,
      durationMs: input.durationMs,
      waveform: input.waveform,
      blob: input.file,
      localObjectUrl: URL.createObjectURL(input.file),
    };
    this.jobs.set(clientGeneratedId, job);
    try {
      await this.persist(job);
    } catch {
      // The in-memory job is enough to show and send; resume after refresh is the only loss.
    }
    this.emit();
    this.pump();
    return clientGeneratedId;
  }

  async cancel(clientGeneratedId: string) {
    const job = this.jobs.get(clientGeneratedId);
    if (!job) return;
    this.pauseReasons.set(clientGeneratedId, "cancel");
    this.controllers.get(clientGeneratedId)?.abort();
    job.status = "canceled";
    if (isVoiceJob(job)) {
      if (job.uploadId) {
        await apiCancelMediaUpload(job.uploadId).catch(() => undefined);
      }
    } else if (isVideoJob(job)) {
      if (job.sessionId) {
        await apiCancelVideoUpload(job.sessionId).catch(() => undefined);
      }
      await Promise.allSettled(
        [job.previewUploadId, job.thumbnailUploadId]
          .filter((id): id is string => Boolean(id))
          .map(apiCancelMediaUpload),
      );
    } else {
      await Promise.allSettled(
        job.assets
          .flatMap((asset) => [
            asset.originalUploadId,
            asset.previewUploadId,
            asset.thumbnailUploadId,
          ])
          .filter((id): id is string => Boolean(id))
          .map(apiCancelMediaUpload),
      );
    }
    this.cleanupUrls(job);
    this.jobs.delete(clientGeneratedId);
    this.files.delete(clientGeneratedId);
    this.videoFiles.delete(clientGeneratedId);
    await this.deletePersisted(job);
    this.emit();
    this.pump();
  }

  async cancelAll() {
    const ids = [...this.jobs.keys()];
    for (const id of ids) {
      await this.cancel(id);
    }
  }

  async retry(clientGeneratedId: string, replacementFiles?: File[]) {
    const job = this.jobs.get(clientGeneratedId);
    if (!job) return;
    if (isVoiceJob(job)) {
      if (!job.blob) {
        job.status = "failed";
        job.progress = -1;
        job.lastError = CONSUMER_AUDIO_ERRORS.GONE;
        await this.persistAndEmit(job);
        return;
      }
      job.status = this.connection === "offline" ? "queued" : "preparing";
      job.lastError = undefined;
      job.retryCount += 1;
      await this.persistAndEmit(job);
      this.pump();
      return;
    }
    if (isVideoJob(job)) {
      const nextFile = replacementFiles?.[0];
      if (nextFile) {
        if (job.fingerprint) {
          const actual = await videoResumeFingerprint(nextFile);
          if (actual !== job.fingerprint) {
            job.lastError = CONSUMER_VIDEO_ERRORS.DIFFERENT_FILE;
            job.status = "failed";
            job.needsReselect = true;
            await this.persistAndEmit(job);
            return;
          }
        }
        this.videoFiles.set(clientGeneratedId, nextFile);
        job.needsReselect = false;
        job.originalFilename = nextFile.name || job.originalFilename;
        job.totalBytes = nextFile.size;
        job.mimeType = nextFile.type || job.mimeType;
      }
      if (!this.videoFiles.has(clientGeneratedId)) {
        job.lastError =
          job.origin === "camera"
            ? CONSUMER_VIDEO_ERRORS.CAMERA_GONE
            : CONSUMER_VIDEO_ERRORS.CHOOSE_AGAIN;
        job.status = "failed";
        job.needsReselect = true;
        await this.persistAndEmit(job);
        return;
      }
      job.status = this.connection === "offline" ? "queued" : "preparing";
      job.lastError = undefined;
      job.retryCount += 1;
      await this.persistAndEmit(job);
      this.pump();
      return;
    }
    if (replacementFiles) this.files.set(clientGeneratedId, replacementFiles);
    if (!this.files.has(clientGeneratedId)) {
      job.lastError = "Select the photos again to retry after a refresh.";
      job.status = "failed";
      await this.persist(job);
      this.emit();
      return;
    }
    job.status = this.connection === "offline" ? "queued" : "preparing";
    job.lastError = undefined;
    job.retryCount += 1;
    job.progress = 0;
    job.completedUploadIds = [];
    for (const asset of job.assets) {
      asset.originalUploadId = undefined;
      asset.previewUploadId = undefined;
      asset.thumbnailUploadId = undefined;
    }
    await this.persist(job);
    this.emit();
    this.pump();
  }

  private hydrate() {
    if (this.hydrateTask) return this.hydrateTask;
    this.hydrateTask = this.readPersistedJobs();
    return this.hydrateTask;
  }

  private async readPersistedJobs() {
    if (typeof indexedDB === "undefined") return;
    const db = getChatDb();
    try {
      const photoRows = await db.pendingUploads.toArray();
      for (const row of photoRows) {
        if (row.status !== "canceled") {
          row.kind = "photo";
          row.status = "failed";
          row.progress = -1;
          row.lastError = "Select the photos again to retry after a refresh.";
          this.jobs.set(row.clientGeneratedId, row);
        }
      }
    } catch {
      // Photo queue may be missing on a brand-new profile.
    }
    try {
      const videoRows = await db.pendingVideoUploads.toArray();
      for (const row of videoRows) {
        if (row.status === "canceled") continue;
        row.kind = "video";
        row.needsReselect = true;
        row.status = "failed";
        row.lastError =
          row.origin === "camera"
            ? CONSUMER_VIDEO_ERRORS.CAMERA_GONE
            : CONSUMER_VIDEO_ERRORS.CHOOSE_AGAIN;
        row.progress = videoProgress(row);
        if (row.posterBlob) {
          row.localPosterUrl = URL.createObjectURL(row.posterBlob);
        }
        this.jobs.set(row.clientGeneratedId, row);
      }
    } catch {
      // Video queue is added in Dexie v3; a mid-upgrade read should not wipe photos.
    }
    try {
      const voiceRows = await db.pendingVoiceUploads.toArray();
      for (const row of voiceRows) {
        if (row.status === "canceled") continue;
        row.kind = "voice";
        if (row.blob) {
          // The recording survived, so this can pick itself back up unattended.
          row.localObjectUrl = URL.createObjectURL(row.blob);
          row.status = "queued";
          row.lastError = undefined;
        } else {
          row.status = "failed";
          row.progress = -1;
          row.lastError = CONSUMER_AUDIO_ERRORS.GONE;
        }
        this.jobs.set(row.clientGeneratedId, row);
      }
    } catch {
      // Voice queue is added in Dexie v4; a mid-upgrade read should not wipe the rest.
    }
    this.emit();
    this.pump();
  }

  private snapshot(): PhotoUploadSnapshot {
    return {
      jobs: [...this.jobs.values()].map((job) =>
        isVoiceJob(job)
          ? { ...job, waveform: [...job.waveform] }
          : isVideoJob(job)
            ? { ...job, completedParts: [...job.completedParts] }
            : { ...job, assets: [...job.assets] },
      ),
      optimisticMessages: this.getOptimisticMessages(),
    };
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private emitThrottled() {
    const now = Date.now();
    if (now - this.lastProgressEmit < 100) return;
    this.lastProgressEmit = now;
    this.emit();
  }

  setCallActive(active: boolean) {
    this.callActive = active;
    this.pump();
  }

  getConcurrency() {
    return this.concurrency();
  }

  private concurrency() {
    if (this.connection === "offline") return 0;
    if (this.callActive) return 1;
    return this.connection === "poor" || this.connection === "reconnecting" ? 1 : 2;
  }

  private pump() {
    const limit = this.concurrency();
    if (!limit) return;
    const candidates = [...this.jobs.values()].filter(
      (job) =>
        !this.running.has(job.clientGeneratedId) &&
        (job.status === "queued" || job.status === "preparing") &&
        !(isVideoJob(job) && job.needsReselect),
    );
    while (this.running.size < limit && candidates.length) {
      const job = candidates.shift()!;
      this.running.add(job.clientGeneratedId);
      const run = isVoiceJob(job)
        ? this.runVoice(job)
        : isVideoJob(job)
          ? this.runVideo(job)
          : this.run(job);
      void run.finally(() => {
        this.running.delete(job.clientGeneratedId);
        this.controllers.delete(job.clientGeneratedId);
        this.pauseReasons.delete(job.clientGeneratedId);
        this.pump();
      });
    }
  }

  private async run(job: PendingPhotoUpload) {
    const files = this.files.get(job.clientGeneratedId);
    if (!files?.length) {
      job.status = "failed";
      job.progress = -1;
      job.lastError = "Select the photos again to retry.";
      await this.persistAndEmit(job);
      return;
    }
    const controller = new AbortController();
    this.controllers.set(job.clientGeneratedId, controller);
    try {
      job.status = "preparing";
      job.progress = 1;
      await this.persistAndEmit(job);
      const prepared = await processImagesOneAtATime(files, async (file, index) => {
        const derivatives = await createImageDerivatives(file);
        const meta = job.assets[index]!;
        meta.width = derivatives.width;
        meta.height = derivatives.height;
        meta.mimeType = await resolveOriginalFileMime(file);
        meta.checksum = await sha256Hex(derivatives.originalFile);
        meta.localThumbUrl = URL.createObjectURL(derivatives.thumb.blob);
        await this.persistAndEmit(job);
        return { meta, derivatives };
      });
      await this.uploadPrepared(job, prepared, controller.signal);
      job.status = "finalizing";
      job.progress = 99;
      await this.persistAndEmit(job);
      const result = await apiFinalizePhotoMessage({
        clientGeneratedId: job.clientGeneratedId,
        caption: job.caption || undefined,
        replyToMessageId: job.replyToMessageId,
        assets: job.assets.map((asset) => ({
          clientAssetId: asset.clientAssetId,
          sortOrder: asset.sortOrder,
          originalUploadId: asset.originalUploadId!,
          previewUploadId: asset.previewUploadId!,
          thumbnailUploadId: asset.thumbnailUploadId!,
          width: asset.width!,
          height: asset.height!,
          mimeType: asset.mimeType,
          originalFilename: asset.originalFilename,
          checksum: asset.checksum,
        })),
      });
      this.finalized.set(job.clientGeneratedId, result.message);
      this.jobs.delete(job.clientGeneratedId);
      this.files.delete(job.clientGeneratedId);
      this.cleanupUrls(job);
      await this.deletePersisted(job);
      this.emit();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      job.status = this.connection === "offline" ? "queued" : "failed";
      job.progress = job.status === "failed" ? -1 : job.progress;
      job.lastError = mapMediaErrorToConsumer(
        error instanceof Error ? error.message : "Photo upload failed.",
      );
      await this.persistAndEmit(job);
    }
  }

  private async runVoice(job: PendingVoiceUpload) {
    const blob = job.blob;
    if (!blob) {
      job.status = "failed";
      job.progress = -1;
      job.lastError = CONSUMER_AUDIO_ERRORS.GONE;
      await this.persistAndEmit(job);
      return;
    }
    const controller = new AbortController();
    this.controllers.set(job.clientGeneratedId, controller);
    try {
      job.status = "preparing";
      job.progress = 1;
      await this.persistAndEmit(job);

      const initialized = await apiInitVoiceUpload({
        clientGeneratedId: job.clientGeneratedId,
        clientAssetId: job.clientAssetId,
        mediaFolderId: job.mediaFolderId,
        mimeType: job.mimeType,
        size: job.totalBytes,
        durationMs: job.durationMs,
      });
      job.uploadId = initialized.uploadId;
      await this.persistAndEmit(job);

      if (initialized.upload) {
        job.status = "uploading";
        await this.persistAndEmit(job);
        await uploadBlobWithProgress({
          ...initialized.upload,
          blob,
          signal: controller.signal,
          onProgress: (loaded) => {
            job.progress = Math.min(97, Math.round((loaded / Math.max(1, job.totalBytes)) * 97));
            this.emitThrottled();
          },
        });
        await apiCompleteMediaUpload(initialized.uploadId);
      }

      job.status = "finalizing";
      job.progress = 99;
      await this.persistAndEmit(job);
      const result = await apiFinalizeVoiceMessage({
        clientGeneratedId: job.clientGeneratedId,
        uploadId: initialized.uploadId,
        durationMs: job.durationMs,
        waveform: job.waveform,
        replyToMessageId: job.replyToMessageId,
      });
      this.finalized.set(job.clientGeneratedId, result.message);
      this.jobs.delete(job.clientGeneratedId);
      this.cleanupUrls(job);
      await this.deletePersisted(job);
      this.emit();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Paused because the connection dropped; keep it queued to resume itself.
        if (this.pauseReasons.get(job.clientGeneratedId) === "pause") {
          job.status = "queued";
          job.lastError = CONSUMER_AUDIO_ERRORS.WAITING;
          await this.persistAndEmit(job);
        }
        return;
      }
      if (this.connection === "offline") {
        job.status = "queued";
        job.lastError = CONSUMER_AUDIO_ERRORS.WAITING;
        await this.persistAndEmit(job);
        return;
      }
      job.status = "failed";
      job.progress = -1;
      job.lastError = mapMediaErrorToConsumer(
        error instanceof Error ? error.message : CONSUMER_AUDIO_ERRORS.SEND_FAILED,
      );
      await this.persistAndEmit(job);
    }
  }

  private async runVideo(job: PendingVideoUpload) {
    const file = this.videoFiles.get(job.clientGeneratedId);
    if (!file) {
      job.status = "failed";
      job.needsReselect = true;
      job.lastError = CONSUMER_VIDEO_ERRORS.CHOOSE_AGAIN;
      await this.persistAndEmit(job);
      return;
    }
    const controller = new AbortController();
    this.controllers.set(job.clientGeneratedId, controller);
    this.pauseReasons.delete(job.clientGeneratedId);
    try {
      job.status = "preparing";
      job.progress = 1;
      job.needsReselect = false;
      await this.persistAndEmit(job);

      if (!job.fingerprint) {
        job.fingerprint = await videoResumeFingerprint(file);
        job.mimeType = await resolveOriginalVideoMime(file);
      }

      if (!job.posterBlob) {
        const poster = await createVideoPoster(file);
        job.width = poster.width || job.width;
        job.height = poster.height || job.height;
        job.durationMs = poster.durationMs || job.durationMs;
        if (poster.preview) {
          job.posterBlob = poster.preview.blob;
          job.localPosterUrl = URL.createObjectURL(poster.preview.blob);
          await this.persistAndEmit(job);
          try {
            job.previewUploadId = await this.uploadPosterVariant(
              job,
              "preview",
              poster.preview.blob,
              poster.preview.mimeType,
              controller.signal,
            );
            job.thumbnailUploadId = await this.uploadPosterVariant(
              job,
              "thumbnail",
              poster.thumb?.blob ?? poster.preview.blob,
              poster.thumb?.mimeType ?? poster.preview.mimeType,
              controller.signal,
            );
          } catch {
            job.previewUploadId = undefined;
            job.thumbnailUploadId = undefined;
          }
        }
      }

      const initialized = await apiInitVideoUpload({
        clientGeneratedId: job.clientGeneratedId,
        clientAssetId: job.clientAssetId,
        mediaFolderId: job.mediaFolderId,
        filename: job.originalFilename,
        mimeType: job.mimeType,
        size: file.size,
        fingerprint: job.fingerprint,
        durationMs: job.durationMs,
        width: job.width,
        height: job.height,
      });
      job.sessionId = initialized.sessionId;
      job.partSize = initialized.partSize;
      job.totalParts = initialized.totalParts;
      job.totalBytes = initialized.totalBytes;
      await this.persistAndEmit(job);

      try {
        const remote = await apiGetVideoUploadSession(initialized.sessionId);
        job.completedParts = remote.completedParts.map((part) => part.partNumber);
        job.uploadedBytes = remote.uploadedBytes;
        job.progress = videoProgress(job);
        await this.persistAndEmit(job);
      } catch {
        // Resume bookkeeping is best-effort; missing parts will be uploaded.
      }

      job.status = "uploading";
      await this.persistAndEmit(job);

      const completed = new Set(job.completedParts);
      await uploadMissingVideoParts({
        file,
        sessionId: job.sessionId,
        partSize: job.partSize,
        totalParts: job.totalParts,
        totalBytes: job.totalBytes,
        completedParts: completed,
        concurrency: () => this.concurrency(),
        signal: controller.signal,
        onPartComplete: async ({ uploadedBytes, partNumber }) => {
          job.completedParts = [...completed];
          job.uploadedBytes = uploadedBytes;
          job.progress = videoProgress(job);
          await this.persist(job);
          this.emitThrottled();
          void partNumber;
        },
        onProgress: (uploadedBytes) => {
          job.uploadedBytes = uploadedBytes;
          job.progress = videoProgress(job);
          this.emitThrottled();
        },
      });

      job.status = "finalizing";
      job.progress = 99;
      await this.persistAndEmit(job);
      const result = await apiCompleteVideoUpload(job.sessionId, {
        caption: job.caption || undefined,
        previewUploadId: job.previewUploadId,
        thumbnailUploadId: job.thumbnailUploadId,
        durationMs: job.durationMs,
        width: job.width,
        height: job.height,
        replyToMessageId: job.replyToMessageId,
      });
      this.finalized.set(job.clientGeneratedId, result.message);
      this.jobs.delete(job.clientGeneratedId);
      this.videoFiles.delete(job.clientGeneratedId);
      this.cleanupUrls(job);
      await this.deletePersisted(job);
      this.emit();
    } catch (error) {
      if (error instanceof VideoUploadPausedError || this.connection === "offline") {
        job.status = "queued";
        job.lastError = CONSUMER_VIDEO_ERRORS.WAITING;
        await this.persistAndEmit(job);
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        if (this.pauseReasons.get(job.clientGeneratedId) === "pause") {
          job.status = "queued";
          job.lastError = CONSUMER_VIDEO_ERRORS.WAITING;
          await this.persistAndEmit(job);
        }
        return;
      }
      job.status = "failed";
      job.progress = job.progress > 0 ? job.progress : -1;
      job.lastError = mapMediaErrorToConsumer(
        error instanceof Error ? error.message : CONSUMER_VIDEO_ERRORS.SEND_FAILED,
      );
      await this.persistAndEmit(job);
    }
  }

  private async uploadPosterVariant(
    job: PendingVideoUpload,
    variant: Extract<UploadVariant, "preview" | "thumbnail">,
    blob: Blob,
    mimeType: string,
    signal: AbortSignal,
  ) {
    const initialized = await apiInitMediaUpload({
      clientGeneratedId: job.clientGeneratedId,
      clientAssetId: job.clientAssetId,
      mediaFolderId: job.mediaFolderId,
      variant,
      filename: `${job.clientAssetId}-${variant}.${derivativeFilenameStem(
        mimeType === "image/jpeg" ? "image/jpeg" : "image/webp",
      )}`,
      mimeType,
      size: blob.size,
      width: job.width,
      height: job.height,
    });
    await uploadBlobWithProgress({
      ...initialized.upload,
      blob,
      signal,
    });
    await apiCompleteMediaUpload(initialized.uploadId);
    return initialized.uploadId;
  }

  private async uploadPrepared(
    job: PendingPhotoUpload,
    prepared: PreparedAsset[],
    signal: AbortSignal,
  ) {
    job.status = "uploading";
    const sizes = prepared.flatMap(({ derivatives }) => [
      derivatives.originalFile.size,
      derivatives.preview.blob.size,
      derivatives.thumb.blob.size,
    ]);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    let completedBytes = 0;
    const completed = new Set(job.completedUploadIds ?? []);

    for (const { meta, derivatives } of prepared) {
      const variants: Array<{
        variant: UploadVariant;
        blob: Blob;
        filename: string;
        mimeType: string;
        idKey: "originalUploadId" | "previewUploadId" | "thumbnailUploadId";
      }> = [
        {
          variant: "original",
          blob: derivatives.originalFile,
          filename: meta.originalFilename,
          mimeType: meta.mimeType,
          idKey: "originalUploadId",
        },
        {
          variant: "preview",
          blob: derivatives.preview.blob,
          filename: `${meta.clientAssetId}-preview.${derivativeFilenameStem(derivatives.preview.mimeType)}`,
          mimeType: derivatives.preview.mimeType,
          idKey: "previewUploadId",
        },
        {
          variant: "thumbnail",
          blob: derivatives.thumb.blob,
          filename: `${meta.clientAssetId}-thumb.${derivativeFilenameStem(derivatives.thumb.mimeType)}`,
          mimeType: derivatives.thumb.mimeType,
          idKey: "thumbnailUploadId",
        },
      ];
      for (const item of variants) {
        const priorId = meta[item.idKey];
        if (priorId && completed.has(priorId)) {
          completedBytes += item.blob.size;
          continue;
        }
        const initialized = await apiInitMediaUpload({
          clientGeneratedId: job.clientGeneratedId,
          clientAssetId: meta.clientAssetId,
          mediaFolderId: meta.mediaFolderId,
          variant: item.variant,
          filename: item.filename,
          mimeType: item.mimeType,
          size: item.blob.size,
          width: meta.width,
          height: meta.height,
          checksum: item.variant === "original" ? meta.checksum : undefined,
        });
        meta[item.idKey] = initialized.uploadId;
        await this.persist(job);
        await uploadBlobWithProgress({
          ...initialized.upload,
          blob: item.blob,
          signal,
          onProgress: (loaded) => {
            job.progress = Math.min(98, Math.round(((completedBytes + loaded) / total) * 98));
            this.emit();
          },
        });
        await apiCompleteMediaUpload(
          initialized.uploadId,
          item.variant === "original" ? meta.checksum : undefined,
        );
        completed.add(initialized.uploadId);
        job.completedUploadIds = [...completed];
        completedBytes += item.blob.size;
        await this.persistAndEmit(job);
      }
    }
  }

  private toOptimistic(job: PendingUploadJob): ChatMessage {
    if (isVoiceJob(job)) {
      const media: ChatMediaItem[] = [
        {
          id: job.clientAssetId,
          sortOrder: 0,
          mimeType: job.mimeType,
          mediaType: "audio",
          width: null,
          height: null,
          durationMs: job.durationMs,
          originalSizeBytes: job.totalBytes,
          previewSizeBytes: null,
          originalFilename: null,
          uploadStatus: job.status,
          hasPreview: false,
          hasThumbnail: false,
          // Playable straight from the local recording, before the upload lands.
          localObjectUrl: job.localObjectUrl,
          waveform: job.waveform,
        },
      ];
      return {
        id: job.clientGeneratedId,
        conversationId: job.conversationId,
        senderId: job.senderId,
        clientGeneratedId: job.clientGeneratedId,
        type: "audio",
        textContent: "",
        createdAt: job.createdAt,
        editedAt: null,
        deletedAt: null,
        deliveredAt: null,
        readAt: null,
        replyTo: job.replyTo ?? null,
        media,
        uploadProgress: job.status === "failed" ? -1 : job.progress,
        uploadError: job.status === "failed" ? job.lastError : undefined,
      };
    }
    if (isVideoJob(job)) {
      const poster = job.localPosterUrl;
      const media: ChatMediaItem[] = [
        {
          id: job.clientAssetId,
          sortOrder: 0,
          mimeType: job.mimeType,
          mediaType: "video",
          width: job.width ?? null,
          height: job.height ?? null,
          durationMs: job.durationMs ?? null,
          originalSizeBytes: job.totalBytes,
          previewSizeBytes: job.posterBlob?.size ?? null,
          originalFilename: job.originalFilename,
          uploadStatus: job.status,
          hasPreview: Boolean(poster),
          hasThumbnail: Boolean(poster),
          localObjectUrl: poster,
          localThumbUrl: poster,
          needsReselect: job.needsReselect,
          origin: job.origin,
        },
      ];
      return {
        id: job.clientGeneratedId,
        conversationId: job.conversationId,
        senderId: job.senderId,
        clientGeneratedId: job.clientGeneratedId,
        type: "video",
        textContent: job.caption,
        createdAt: job.createdAt,
        editedAt: null,
        deletedAt: null,
        deliveredAt: null,
        readAt: null,
        replyTo: job.replyTo ?? null,
        media,
        uploadProgress: job.status === "failed" && job.progress < 0 ? -1 : job.progress,
        uploadError: job.status === "failed" ? job.lastError : undefined,
      };
    }
    const media: ChatMediaItem[] = job.assets.map((asset) => ({
      id: asset.clientAssetId,
      sortOrder: asset.sortOrder,
      mimeType: asset.mimeType,
      mediaType: "image",
      width: asset.width ?? null,
      height: asset.height ?? null,
      originalSizeBytes: asset.originalSize,
      previewSizeBytes: null,
      originalFilename: asset.originalFilename,
      uploadStatus: job.status,
      hasPreview: Boolean(asset.localObjectUrl),
      hasThumbnail: Boolean(asset.localThumbUrl),
      localObjectUrl: asset.localObjectUrl,
      localThumbUrl: asset.localThumbUrl,
    }));
    return {
      id: job.clientGeneratedId,
      conversationId: job.conversationId,
      senderId: job.senderId,
      clientGeneratedId: job.clientGeneratedId,
      type: "image",
      textContent: job.caption,
      createdAt: job.createdAt,
      editedAt: null,
      deletedAt: null,
      deliveredAt: null,
      readAt: null,
      replyTo: job.replyTo ?? null,
      media,
      uploadProgress: job.status === "failed" ? -1 : job.progress,
      uploadError: job.status === "failed" ? job.lastError : undefined,
    };
  }

  private async persist(job: PendingUploadJob) {
    if (typeof indexedDB === "undefined") return;
    if (isVoiceJob(job)) {
      // The object URL dies with the page; the blob is what makes resume possible.
      const persisted: PendingVoiceUpload = { ...job, localObjectUrl: undefined };
      await getChatDb().pendingVoiceUploads.put(persisted);
      return;
    }
    if (isVideoJob(job)) {
      const persisted: PendingVideoUpload = {
        kind: "video",
        clientGeneratedId: job.clientGeneratedId,
        conversationId: job.conversationId,
        senderId: job.senderId,
        caption: job.caption,
        replyToMessageId: job.replyToMessageId,
        replyTo: job.replyTo,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        retryCount: job.retryCount,
        lastError: job.lastError,
        sessionId: job.sessionId,
        clientAssetId: job.clientAssetId,
        mediaFolderId: job.mediaFolderId,
        originalFilename: job.originalFilename,
        mimeType: job.mimeType,
        totalBytes: job.totalBytes,
        partSize: job.partSize,
        totalParts: job.totalParts,
        fingerprint: job.fingerprint,
        completedParts: [...job.completedParts],
        uploadedBytes: job.uploadedBytes,
        durationMs: job.durationMs,
        width: job.width,
        height: job.height,
        previewUploadId: job.previewUploadId,
        thumbnailUploadId: job.thumbnailUploadId,
        needsReselect: job.needsReselect,
        posterBlob: job.posterBlob,
        origin: job.origin,
      };
      await getChatDb().pendingVideoUploads.put(persisted);
      return;
    }
    const persisted: PendingPhotoUpload = {
      ...job,
      assets: job.assets.map((asset) => ({
        ...asset,
        localObjectUrl: undefined,
        localThumbUrl: undefined,
      })),
    };
    await getChatDb().pendingUploads.put(persisted);
  }

  private async deletePersisted(job: PendingUploadJob | string) {
    if (typeof indexedDB === "undefined") return;
    if (typeof job === "string") {
      await getChatDb().pendingUploads.delete(job);
      await getChatDb().pendingVideoUploads.delete(job);
      await getChatDb().pendingVoiceUploads.delete(job);
      return;
    }
    if (isVoiceJob(job)) {
      await getChatDb().pendingVoiceUploads.delete(job.clientGeneratedId);
      return;
    }
    if (isVideoJob(job)) {
      await getChatDb().pendingVideoUploads.delete(job.clientGeneratedId);
      return;
    }
    await getChatDb().pendingUploads.delete(job.clientGeneratedId);
  }

  private async persistAndEmit(job: PendingUploadJob) {
    await this.persist(job);
    this.emit();
  }

  private cleanupUrls(job: PendingUploadJob) {
    if (isVoiceJob(job)) {
      if (job.localObjectUrl) URL.revokeObjectURL(job.localObjectUrl);
      return;
    }
    if (isVideoJob(job)) {
      if (job.localPosterUrl) URL.revokeObjectURL(job.localPosterUrl);
      if (job.localObjectUrl) URL.revokeObjectURL(job.localObjectUrl);
      return;
    }
    for (const asset of job.assets) {
      if (asset.localObjectUrl) URL.revokeObjectURL(asset.localObjectUrl);
      if (asset.localThumbUrl) URL.revokeObjectURL(asset.localThumbUrl);
    }
  }
}

export const uploadManager = new UploadManager();
