import { z } from "zod";

import { MUSIC_CLIP_MAX_MS } from "@/lib/music/clip";

export const musicUrlSchema = z.object({
  url: z.string().trim().min(8).max(2_000),
});

export const saveTrackSchema = z.object({
  url: z.string().trim().min(8).max(2_000).optional(),
  trackId: z.uuid().optional(),
  youtubeVideoId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{11}$/)
    .optional(),
  save: z.enum(["personal", "shared"]).optional(),
  recommend: z
    .object({
      note: z.string().trim().max(280).optional(),
      clientGeneratedId: z.uuid(),
    })
    .optional(),
  playlistId: z.uuid().optional(),
});

export const libraryPatchSchema = z.object({
  scope: z.enum(["personal", "shared"]),
  saved: z.boolean(),
});

export const recommendSchema = z.object({
  note: z.string().trim().max(280).optional(),
  clientGeneratedId: z.uuid(),
});

export const recommendationReactSchema = z.object({
  reaction: z.enum(["loved", "liked", "not_for_me"]),
});

export const playlistCreateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  note: z.string().trim().max(280).optional(),
  collaborative: z.boolean().optional(),
});

export const playlistPatchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(280).nullable().optional(),
  collaborative: z.boolean().optional(),
  coverTrackId: z.uuid().nullable().optional(),
});

export const playlistOrderSchema = z.object({
  trackIds: z.array(z.uuid()).min(1).max(500),
});

export const playlistAddSchema = z.object({
  trackId: z.uuid(),
});

export const memoryCreateSchema = z.object({
  text: z.string().trim().min(1).max(500),
  clientGeneratedId: z.uuid(),
});

export const playbackSourceSchema = z.object({
  youtubeVideoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
});

export const musicSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  discover: z.enum(["0", "1"]).optional().default("0"),
});

export const sendMusicSchema = z.object({
  trackId: z.uuid(),
  clientGeneratedId: z.uuid(),
  text: z.string().trim().max(500).optional(),
  replyToMessageId: z.uuid().optional(),
  clipStartMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  clipEndMs: z.number().int().min(1).max(24 * 60 * 60 * 1000).optional(),
  youtubeVideoId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{11}$/)
    .optional(),
});

export const recentlyPlayedSchema = z.object({
  trackId: z.uuid(),
});

export { MUSIC_CLIP_MAX_MS };
