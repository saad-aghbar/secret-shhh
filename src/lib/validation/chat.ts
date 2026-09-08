import { z } from "zod";

import { MESSAGE_PAGE_MAX, MESSAGE_PAGE_SIZE, RECEIPT_BATCH_MAX } from "@/lib/chat/types";
import { DEFAULT_MESSAGE_TEXT_MAX_LENGTH, graphemeLength } from "@/lib/text/graphemes";

export function messageTextMaxLength(): number {
  const raw = process.env.MESSAGE_TEXT_MAX_LENGTH;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 500 && parsed <= 20_000) {
      return parsed;
    }
  }
  return DEFAULT_MESSAGE_TEXT_MAX_LENGTH;
}

export function textContentSchema(max = messageTextMaxLength()) {
  return z
    .string()
    .transform((value) => value.replace(/^\s+|\s+$/gu, ""))
    .refine((value) => value.length > 0, { message: "Message cannot be empty." })
    .refine((value) => graphemeLength(value) <= max, {
      message: "That message is a bit too long.",
    });
}

export const sendMessageSchema = z.union([
  z.object({
    text: textContentSchema(),
    stickerId: z.undefined().optional(),
    doodle: z.undefined().optional(),
    music: z.undefined().optional(),
    clientGeneratedId: z.uuid(),
    replyToMessageId: z.uuid().optional(),
  }),
  z.object({
    stickerId: z.uuid(),
    text: z.undefined().optional(),
    doodle: z.undefined().optional(),
    music: z.undefined().optional(),
    clientGeneratedId: z.uuid(),
    replyToMessageId: z.uuid().optional(),
  }),
  z.object({
    doodle: z.unknown(),
    text: z.undefined().optional(),
    stickerId: z.undefined().optional(),
    music: z.undefined().optional(),
    clientGeneratedId: z.uuid(),
    replyToMessageId: z.uuid().optional(),
  }),
  z.object({
    music: z.object({
      trackId: z.uuid(),
      clipStartMs: z.number().int().min(0).optional(),
      clipEndMs: z.number().int().min(1).optional(),
      youtubeVideoId: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{11}$/)
        .optional(),
    }),
    text: z.string().trim().max(500).optional(),
    stickerId: z.undefined().optional(),
    doodle: z.undefined().optional(),
    clientGeneratedId: z.uuid(),
    replyToMessageId: z.uuid().optional(),
  }),
]);

export const editMessageSchema = z.object({
  text: textContentSchema(),
});

export const setReactionSchema = z.object({
  emoji: z.string().min(1).max(64),
});

export const cursorQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_MAX).default(MESSAGE_PAGE_SIZE),
});

export const markReadSchema = z.object({
  messageIds: z.array(z.uuid()).min(1).max(RECEIPT_BATCH_MAX),
});

export const markDeliveredSchema = z.object({
  messageIds: z.array(z.uuid()).min(1).max(RECEIPT_BATCH_MAX),
});

export const queryReceiptsSchema = z.object({
  messageIds: z.array(z.uuid()).min(1).max(RECEIPT_BATCH_MAX),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
