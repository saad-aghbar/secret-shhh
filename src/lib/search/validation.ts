import { z } from "zod";

import { isValidTimeZone, parseIsoDate } from "@/lib/history/timezone";

export const SEARCH_QUERY_MAX = 200;
export const SEARCH_PAGE_SIZE = 30;
export const SEARCH_PAGE_MAX = 50;

export const searchSenderSchema = z.enum(["anyone", "me", "partner"]);
export const searchTypeSchema = z.enum([
  "all",
  "text",
  "links",
  "photos",
  "videos",
  "voice",
  "stickers",
  "doodles",
  "calls",
  "music",
]);

/** Types not in the search filter pills yet. */
export const FUTURE_SEARCH_TYPES = [] as const;

export const searchMessagesQuerySchema = z
  .object({
    q: z.string().max(SEARCH_QUERY_MAX).optional().default(""),
    sender: searchSenderSchema.optional().default("anyone"),
    from: z
      .string()
      .optional()
      .refine((v) => v === undefined || parseIsoDate(v) !== null, { message: "Invalid from date." }),
    to: z
      .string()
      .optional()
      .refine((v) => v === undefined || parseIsoDate(v) !== null, { message: "Invalid to date." }),
    type: searchTypeSchema.optional().default("all"),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(SEARCH_PAGE_MAX).default(SEARCH_PAGE_SIZE),
    tz: z
      .string()
      .min(1)
      .max(64)
      .optional()
      .default("UTC")
      .refine((v) => isValidTimeZone(v), { message: "Invalid timezone." }),
  })
  .superRefine((val, ctx) => {
    if (val.from && val.to && val.from > val.to) {
      ctx.addIssue({ code: "custom", message: "From date must be on or before to date.", path: ["from"] });
    }
  });

export type SearchMessagesQuery = z.infer<typeof searchMessagesQuerySchema>;

export const historyMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  tz: z
    .string()
    .min(1)
    .max(64)
    .default("UTC")
    .refine((v) => isValidTimeZone(v), { message: "Invalid timezone." }),
});

export const historyDayQuerySchema = z.object({
  date: z.string().refine((v) => parseIsoDate(v) !== null, { message: "Invalid date." }),
  tz: z
    .string()
    .min(1)
    .max(64)
    .default("UTC")
    .refine((v) => isValidTimeZone(v), { message: "Invalid timezone." }),
});

export const historyAdjacentQuerySchema = historyDayQuerySchema.extend({
  dir: z.enum(["prev", "next"]),
});

export const messageContextQuerySchema = z.object({
  before: z.coerce.number().int().min(0).max(50).default(30),
  after: z.coerce.number().int().min(0).max(50).default(30),
});
