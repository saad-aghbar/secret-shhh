import { compareMessages } from "@/lib/chat/serialize";
import type {
  ChatMessage,
  DoodleRef,
  MessageSendStatus,
  ReplyPreview,
  StickerRef,
} from "@/lib/chat/types";

export type PendingMessage = {
  clientGeneratedId: string;
  conversationId: string;
  senderId: string;
  textContent: string;
  status: Extract<MessageSendStatus, "preparing" | "queued" | "sending" | "failed">;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  serverId?: string;
  replyToMessageId?: string;
  replyTo?: ReplyPreview | null;
  stickerId?: string;
  sticker?: StickerRef;
  doodle?: DoodleRef;
};

export type PendingMutationKind = "edit" | "delete" | "reaction-set" | "reaction-clear";

export type PendingMutation = {
  id: string;
  kind: PendingMutationKind;
  messageId: string;
  payload: { text?: string; emoji?: string };
  status: Extract<MessageSendStatus, "queued" | "sending" | "failed">;
  retryCount: number;
  lastError?: string;
  createdAt: string;
};

export function mutationKey(kind: PendingMutationKind, messageId: string) {
  if (kind === "reaction-set" || kind === "reaction-clear") {
    return `reaction:${messageId}`;
  }
  return `${kind}:${messageId}`;
}

export function pendingToOptimistic(pending: PendingMessage): ChatMessage {
  const isDoodle = Boolean(pending.doodle);
  const isSticker = Boolean(pending.stickerId);
  return {
    id: pending.serverId ?? pending.clientGeneratedId,
    conversationId: pending.conversationId,
    senderId: pending.senderId,
    clientGeneratedId: pending.clientGeneratedId,
    type: isDoodle ? "doodle" : isSticker ? "sticker" : "text",
    textContent: isDoodle || isSticker ? "" : pending.textContent,
    createdAt: pending.createdAt,
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null,
    replyTo: pending.replyTo ?? null,
    sticker: pending.sticker,
    doodle: pending.doodle,
  };
}

/**
 * One visible row even if the same send arrived via optimistic insert,
 * HTTP, realtime, and reconnect sync.
 */
export function mergeMessages(cached: ChatMessage[], pending: PendingMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClient = new Map<string, ChatMessage>();

  for (const message of cached) {
    byId.set(message.id, message);
    byClient.set(message.clientGeneratedId, message);
  }

  const extras: ChatMessage[] = [];
  for (const item of pending) {
    if (item.serverId && byId.has(item.serverId)) {
      continue;
    }
    if (byClient.has(item.clientGeneratedId)) {
      continue;
    }
    extras.push(pendingToOptimistic(item));
  }

  return [...cached, ...extras].sort(compareMessages);
}

export function upsertMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const next = list.filter(
    (message) =>
      message.id !== incoming.id && message.clientGeneratedId !== incoming.clientGeneratedId,
  );
  next.push(incoming);
  return next.sort(compareMessages);
}

export function outgoingStatus(
  message: ChatMessage,
  pending: PendingMessage | undefined,
  isOwn: boolean,
): MessageSendStatus {
  if (!isOwn) {
    return "sent";
  }
  if (pending && !pending.serverId) {
    return pending.status;
  }
  if (
    (message.type === "image" || message.type === "video" || message.type === "audio") &&
    message.id === message.clientGeneratedId &&
    typeof message.uploadProgress === "number"
  ) {
    return message.uploadProgress < 0 ? "failed" : "uploading";
  }
  if (message.readAt) {
    return "read";
  }
  if (message.deliveredAt) {
    return "delivered";
  }
  return "sent";
}

export type ReceiptPatch = {
  messageId: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

export function applyReceiptPatches(list: ChatMessage[], patches: ReceiptPatch[]): ChatMessage[] {
  if (patches.length === 0) {
    return list;
  }
  const byId = new Map(patches.map((patch) => [patch.messageId, patch]));
  let changed = false;
  const next = list.map((message) => {
    const patch = byId.get(message.id);
    if (!patch) {
      return message;
    }
    // Receipts only move forward — never clear a known delivered/read timestamp.
    const deliveredAt = patch.deliveredAt != null ? patch.deliveredAt : message.deliveredAt;
    const readAt = patch.readAt != null ? patch.readAt : message.readAt;
    if (deliveredAt === message.deliveredAt && readAt === message.readAt) {
      return message;
    }
    changed = true;
    return { ...message, deliveredAt, readAt };
  });
  return changed ? next : list;
}

export function applyMessagePatch(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  return upsertMessage(list, incoming);
}

function sameReactions(left?: ChatMessage["reactions"], right?: ChatMessage["reactions"]) {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  return a.every(
    (item, index) =>
      item.userId === b[index]?.userId &&
      item.emoji === b[index]?.emoji &&
      item.createdAt === b[index]?.createdAt,
  );
}

function sameMedia(left?: ChatMessage["media"], right?: ChatMessage["media"]) {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  return a.every(
    (item, index) =>
      item.id === b[index]?.id && item.uploadStatus === b[index]?.uploadStatus,
  );
}

function sameDoodle(left?: DoodleRef, right?: DoodleRef) {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  return (
    left.id === right.id &&
    left.version === right.version &&
    left.aspectRatio === right.aspectRatio &&
    left.document.strokes.length === right.document.strokes.length
  );
}

function sameSticker(left?: StickerRef, right?: StickerRef) {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  return (
    left.id === right.id &&
    left.archived === right.archived &&
    left.name === right.name &&
    left.saved === right.saved &&
    left.animated === right.animated &&
    left.width === right.width &&
    left.height === right.height
  );
}

/**
 * Keep the live row object when a reconcile fetch did not change anything the
 * bubble cares about. Replacing an unchanged voice/photo row remounts players.
 */
export function reconcileCachedMessage(current: ChatMessage, incoming: ChatMessage): ChatMessage {
  if (
    current.textContent === incoming.textContent &&
    current.editedAt === incoming.editedAt &&
    current.deletedAt === incoming.deletedAt &&
    current.deliveredAt === incoming.deliveredAt &&
    current.readAt === incoming.readAt &&
    sameReactions(current.reactions, incoming.reactions) &&
    sameMedia(current.media, incoming.media) &&
    sameSticker(current.sticker, incoming.sticker) &&
    sameDoodle(current.doodle, incoming.doodle)
  ) {
    return current;
  }
  if (
    current.textContent === incoming.textContent &&
    current.editedAt === incoming.editedAt &&
    current.deletedAt === incoming.deletedAt &&
    sameReactions(current.reactions, incoming.reactions) &&
    sameMedia(current.media, incoming.media) &&
    sameSticker(current.sticker, incoming.sticker) &&
    sameDoodle(current.doodle, incoming.doodle)
  ) {
    return {
      ...current,
      deliveredAt: incoming.deliveredAt,
      readAt: incoming.readAt,
    };
  }
  return {
    ...incoming,
    media: sameMedia(current.media, incoming.media) ? current.media : incoming.media,
    sticker: sameSticker(current.sticker, incoming.sticker) ? current.sticker : incoming.sticker,
    doodle: sameDoodle(current.doodle, incoming.doodle) ? current.doodle : incoming.doodle,
    uploadProgress: current.uploadProgress,
    uploadError: current.uploadError,
  };
}
