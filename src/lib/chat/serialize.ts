import { parseCallEventMeta, type CallEventMeta } from "@/lib/calls/events";
import type {
  ChatMediaItem,
  ChatMessage,
  ChatMessageType,
  DoodleRef,
  MessageReaction,
  ReplyPreview,
  StickerRef,
} from "@/lib/chat/types";

export type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  clientGeneratedId: string;
  type: string;
  textContent: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  metadata?: unknown;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function asChatType(type: string): ChatMessageType {
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type === "audio") return "audio";
  if (type === "sticker") return "sticker";
  if (type === "doodle") return "doodle";
  if (type === "call") return "call";
  if (type === "music") return "music";
  return "text";
}

export function serializeMessage(
  row: MessageRow,
  receipts: { deliveredAt: Date | null; readAt: Date | null } | null,
  media: ChatMediaItem[] = [],
  extras: {
    replyTo?: ReplyPreview | null;
    reactions?: MessageReaction[];
    sticker?: StickerRef | null;
    doodle?: DoodleRef | null;
    call?: CallEventMeta | null;
    music?: import("@/lib/chat/types").MusicShareRef | null;
  } = {},
): ChatMessage {
  const deleted = Boolean(row.deletedAt);
  const call = deleted ? undefined : (extras.call ?? parseCallEventMeta(row.metadata) ?? undefined);
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    clientGeneratedId: row.clientGeneratedId,
    type: asChatType(row.type),
    textContent: deleted ? "" : (row.textContent ?? ""),
    createdAt: row.createdAt.toISOString(),
    editedAt: deleted ? null : iso(row.editedAt),
    deletedAt: iso(row.deletedAt),
    deliveredAt: deleted ? null : iso(receipts?.deliveredAt),
    readAt: deleted ? null : iso(receipts?.readAt),
    replyTo: extras.replyTo ?? null,
    reactions: deleted || !extras.reactions?.length ? undefined : extras.reactions,
    media: deleted || media.length === 0 ? undefined : media,
    sticker: deleted ? undefined : (extras.sticker ?? undefined),
    doodle: deleted ? undefined : (extras.doodle ?? undefined),
    call,
    music: deleted ? undefined : (extras.music ?? undefined),
  };
}

export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const byTime = a.createdAt.localeCompare(b.createdAt);
  if (byTime !== 0) {
    return byTime;
  }
  return a.id.localeCompare(b.id);
}

export function tombstoneMessage(message: ChatMessage, deletedAt: string): ChatMessage {
  return {
    ...message,
    textContent: "",
    editedAt: null,
    deletedAt,
    deliveredAt: null,
    readAt: null,
    reactions: undefined,
    media: undefined,
    sticker: undefined,
    doodle: undefined,
    call: undefined,
    music: undefined,
    uploadProgress: undefined,
    uploadError: undefined,
  };
}
