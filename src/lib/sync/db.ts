import Dexie, { type EntityTable } from "dexie";

import type { ChatMessage } from "@/lib/chat/types";
import type { DoodleDocument, DoodleEditorTool } from "@/lib/doodles/document";
import type {
  CachedMusicPlaylist,
  CachedMusicRecommendation,
  CachedMusicTrack,
  PendingMusicMutation,
} from "@/lib/music/offline-types";
import type { PendingMessage, PendingMutation } from "@/lib/sync/merge";
import type {
  PendingPhotoUpload,
  PendingVideoUpload,
  PendingVoiceUpload,
} from "@/lib/uploads/types";

export type SyncStateRow = {
  conversationId: string;
  lastServerMessageId: string | null;
  lastSyncedAt: string | null;
};

export type DraftRow = {
  id: string;
  conversationId: string;
  userId: string;
  text: string;
  updatedAt: string;
};

export function draftKey(conversationId: string, userId: string) {
  return `${conversationId}:${userId}`;
}

export type DoodleDraftRow = {
  id: string;
  conversationId: string;
  userId: string;
  document: DoodleDocument;
  tool: DoodleEditorTool;
  color: string;
  penWidth: number;
  penOpacity: number;
  markerWidth: number;
  markerOpacity: number;
  eraserWidth: number;
  updatedAt: string;
};

/**
 * Versioned local chat store. Migrations must not wipe history on app updates.
 * Text send queue is isolated from any future media upload pipeline.
 */
class ShhhChatDB extends Dexie {
  cachedMessages!: EntityTable<ChatMessage, "id">;
  pendingMessages!: EntityTable<PendingMessage, "clientGeneratedId">;
  pendingUploads!: EntityTable<PendingPhotoUpload, "clientGeneratedId">;
  pendingVideoUploads!: EntityTable<PendingVideoUpload, "clientGeneratedId">;
  pendingVoiceUploads!: EntityTable<PendingVoiceUpload, "clientGeneratedId">;
  syncState!: EntityTable<SyncStateRow, "conversationId">;
  drafts!: EntityTable<DraftRow, "id">;
  doodleDrafts!: EntityTable<DoodleDraftRow, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;
  cachedMusicTracks!: EntityTable<CachedMusicTrack, "id">;
  cachedMusicPlaylists!: EntityTable<CachedMusicPlaylist, "id">;
  cachedMusicRecommendations!: EntityTable<CachedMusicRecommendation, "id">;
  pendingMusicMutations!: EntityTable<PendingMusicMutation, "id">;

  constructor() {
    super("shhh-chat");
    this.version(1).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(2).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(3).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(4).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVoiceUploads: "clientGeneratedId, conversationId, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(5).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVoiceUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingMutations: "id, messageId, kind, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(6).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVoiceUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingMutations: "id, messageId, kind, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
    });
    this.version(7).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVoiceUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingMutations: "id, messageId, kind, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
      doodleDrafts: "id, conversationId, userId, updatedAt",
    });
    this.version(8).stores({
      cachedMessages:
        "id, conversationId, clientGeneratedId, createdAt, [conversationId+createdAt]",
      pendingMessages: "clientGeneratedId, conversationId, status, createdAt",
      pendingUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVideoUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingVoiceUploads: "clientGeneratedId, conversationId, status, createdAt",
      pendingMutations: "id, messageId, kind, status, createdAt",
      syncState: "conversationId",
      drafts: "id, conversationId, userId",
      doodleDrafts: "id, conversationId, userId, updatedAt",
      cachedMusicTracks: "id, title, artistName, updatedAt",
      cachedMusicPlaylists: "id, updatedAt",
      cachedMusicRecommendations: "id, status, updatedAt",
      pendingMusicMutations: "id, kind, trackId, status, createdAt",
    });
  }
}

let db: ShhhChatDB | null = null;

export function getChatDb() {
  // fake-indexeddb provides indexedDB in Node tests without a full window.
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable");
  }
  if (!db) {
    db = new ShhhChatDB();
  }
  return db;
}

/** Test helper — after Dexie.delete(), recreate on next getChatDb(). */
export function resetChatDbSingleton() {
  db = null;
}

export async function clearLocalChatData() {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const instance = getChatDb();
  await instance.transaction(
    "rw",
    [
      instance.cachedMessages,
      instance.pendingMessages,
      instance.pendingUploads,
      instance.pendingVideoUploads,
      instance.pendingVoiceUploads,
      instance.pendingMutations,
      instance.syncState,
      instance.drafts,
      instance.doodleDrafts,
      instance.cachedMusicTracks,
      instance.cachedMusicPlaylists,
      instance.cachedMusicRecommendations,
      instance.pendingMusicMutations,
    ],
    async () => {
      await instance.cachedMessages.clear();
      await instance.pendingMessages.clear();
      await instance.pendingUploads.clear();
      await instance.pendingVideoUploads.clear();
      await instance.pendingVoiceUploads.clear();
      await instance.pendingMutations.clear();
      await instance.syncState.clear();
      await instance.drafts.clear();
      await instance.doodleDrafts.clear();
      await instance.cachedMusicTracks.clear();
      await instance.cachedMusicPlaylists.clear();
      await instance.cachedMusicRecommendations.clear();
      await instance.pendingMusicMutations.clear();
    },
  );
}
