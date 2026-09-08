import type { ChatMessage, MessageReaction } from "@/lib/chat/types";

export function isFinalizedMessage(message: ChatMessage) {
  return message.id !== message.clientGeneratedId;
}

export function messageActionFlags(message: ChatMessage, userId: string) {
  if (message.type === "call") {
    return {
      canReply: false,
      canReact: false,
      canEdit: false,
      canDelete: false,
      canSave: false,
      canSaveSticker: false,
      canUnsaveSticker: false,
      canRenameSticker: false,
    };
  }
  const deleted = Boolean(message.deletedAt);
  const finalized = isFinalizedMessage(message);
  const own = message.senderId === userId;
  const captioned = message.type === "image" || message.type === "video" || message.type === "music";
  return {
    canReply: finalized && !deleted,
    canReact: finalized && !deleted,
    canEdit: finalized && !deleted && own && (message.type === "text" || captioned),
    canDelete: finalized && !deleted && own,
    canSave: finalized && !deleted && Boolean(message.media?.[0]?.id),
    canSaveSticker:
      finalized &&
      !deleted &&
      message.type === "sticker" &&
      Boolean(message.sticker) &&
      !message.sticker?.archived &&
      message.sticker?.creatorId !== userId &&
      !message.sticker?.saved,
    canUnsaveSticker:
      finalized &&
      !deleted &&
      message.type === "sticker" &&
      message.sticker?.creatorId !== userId &&
      Boolean(message.sticker?.saved),
    canRenameSticker:
      finalized &&
      !deleted &&
      message.type === "sticker" &&
      message.sticker?.creatorId === userId &&
      Boolean(message.sticker) &&
      !message.sticker?.archived,
  };
}

export type ReactionSummaryItem = {
  emoji: string;
  count: number;
  mine: boolean;
};

export function summarizeReactions(
  reactions: MessageReaction[] | undefined,
  userId: string,
): ReactionSummaryItem[] {
  if (!reactions?.length) {
    return [];
  }
  const map = new Map<string, ReactionSummaryItem>();
  for (const reaction of reactions) {
    const current = map.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    current.count += 1;
    if (reaction.userId === userId) {
      current.mine = true;
    }
    map.set(reaction.emoji, current);
  }
  return [...map.values()];
}

export function reactionAriaLabel(emoji: string) {
  const names: Record<string, string> = {
    "❤️": "heart",
    "😂": "joy",
    "🥺": "pleading face",
    "😮": "surprised",
    "😭": "loudly crying",
    "😢": "crying",
    "🔥": "fire",
    "👍": "thumbs up",
  };
  return `React with ${names[emoji] ?? emoji}`;
}

export function replyPreviewLabel(
  type: ChatMessage["type"],
  snippet: string | null,
  deleted: boolean,
) {
  if (deleted) {
    return "Message deleted";
  }
  if (snippet) {
    return snippet;
  }
  if (type === "image") return "Photo";
  if (type === "video") return "Video";
  if (type === "audio") return "Voice message";
  if (type === "sticker") return snippet ?? "Sticker";
  if (type === "doodle") return "Doodle";
  if (type === "call") return snippet ?? "Call";
  if (type === "music") return snippet ?? "Song";
  return "Message";
}
