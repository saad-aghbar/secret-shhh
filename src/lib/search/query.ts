import { sql } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { zonedDayBounds } from "@/lib/history/timezone";
import { getDb } from "@/lib/db";
import { makeSearchSnippet, parseSearchQuery } from "@/lib/search/snippets";
import type { SearchMessagesQuery } from "@/lib/search/validation";
import { logInfo } from "@/lib/logger";

export type SearchResultItem = {
  id: string;
  clientGeneratedId: string;
  senderId: string;
  createdAt: string;
  textContent: string;
  snippet: string;
  matchStart: number | null;
  matchEnd: number | null;
  rank: number;
  type: "text" | "image" | "video" | "audio" | "sticker" | "doodle" | "call" | "music";
  mediaId: string | null;
  stickerId: string | null;
  doodleId: string | null;
  hasThumbnail: boolean;
  durationMs: number | null;
  isReply: boolean;
};

export type SearchPage = {
  results: SearchResultItem[];
  nextCursor: string | null;
};

type CursorPayload = {
  rank: number;
  createdAt: string;
  id: string;
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string | undefined): CursorPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as CursorPayload;
    if (
      typeof parsed.rank !== "number" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * PostgreSQL bilingual search.
 * Primary: tsvector `simple` + GIN.
 * Fallback: pg_trgm when query is short (<3) or FTS returns nothing.
 * Never logs `q` (private conversation content).
 */
export async function searchMessages(params: {
  requestId: string;
  conversationId: string;
  viewerId: string;
  query: SearchMessagesQuery;
}): Promise<SearchPage> {
  const started = Date.now();
  const { conversationId, viewerId, query } = params;
  const partnerId = await getConversationPartnerId(conversationId, viewerId);

  let senderId: string | null = null;
  if (query.sender === "me") {
    senderId = viewerId;
  } else if (query.sender === "partner") {
    senderId = partnerId;
  }

  let fromUtc: Date | null = null;
  let toExclusive: Date | null = null;
  if (query.from) {
    fromUtc = zonedDayBounds(query.from, query.tz).start;
  }
  if (query.to) {
    toExclusive = zonedDayBounds(query.to, query.tz).nextStart;
  }

  const parsed = parseSearchQuery(query.q);
  const text = parsed.text;
  const hasText = text.length > 0;
  const useTrgmFirst = hasText && text.length < 3;

  const cursor = decodeCursor(query.cursor);
  const limit = query.limit;

  let page = await runSearch({
    conversationId,
    senderId,
    fromUtc,
    toExclusive,
    type: query.type,
    text,
    mode: parsed.mode,
    strategy: useTrgmFirst ? "trgm" : hasText ? "fts" : "chrono",
    cursor,
    limit,
  });

  // Fallback: FTS empty with longer query → try trigram once.
  if (hasText && !useTrgmFirst && page.rows.length === 0 && !cursor) {
    page = await runSearch({
      conversationId,
      senderId,
      fromUtc,
      toExclusive,
      type: query.type,
      text,
      mode: parsed.mode,
      strategy: "trgm",
      cursor: null,
      limit,
    });
  }

  const hasMore = page.rows.length > limit;
  const slice = hasMore ? page.rows.slice(0, limit) : page.rows;

  const results: SearchResultItem[] = slice.map((row) => {
    const rawSnippet = row.text_content ?? "";
    const { snippet, matchStart, matchEnd } = makeSearchSnippet(rawSnippet, text);
    const isImage = row.type === "image";
    const isVideo = row.type === "video";
    const isAudio = row.type === "audio";
    const isSticker = row.type === "sticker";
    const isDoodle = row.type === "doodle";
    const isCall = row.type === "call";
    const isMusic = row.type === "music";
    return {
      id: row.id,
      clientGeneratedId: row.client_generated_id,
      senderId: row.sender_id,
      createdAt: new Date(row.created_at).toISOString(),
      textContent: row.text_content ?? "",
      snippet:
        snippet ||
        (isImage
          ? "Photo"
          : isVideo
            ? "Video"
            : isAudio
              ? "Voice message"
              : isSticker
                ? "Sticker"
                : isDoodle
                  ? "Doodle"
                  : isCall
                    ? (row.text_content ?? "Call")
                    : isMusic
                      ? (row.text_content ?? "Song")
                      : ""),
      matchStart,
      matchEnd,
      rank: Number(row.rank) || 0,
      type: isImage
        ? "image"
        : isVideo
          ? "video"
          : isAudio
            ? "audio"
            : isSticker
              ? "sticker"
              : isDoodle
                ? "doodle"
                : isCall
                  ? "call"
                  : isMusic
                    ? "music"
                    : "text",
      mediaId: row.media_id ?? null,
      stickerId: row.sticker_id ?? null,
      doodleId: row.doodle_id ?? null,
      hasThumbnail: Boolean(row.has_thumbnail),
      durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
      isReply: Boolean(row.is_reply),
    };
  });

  const last = results[results.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          rank: last.rank,
          createdAt: last.createdAt,
          id: last.id,
        })
      : null;

  logInfo({
    requestId: params.requestId,
    operation: "searchMessages",
    userId: viewerId,
    durationMs: Date.now() - started,
    extra: {
      count: results.length,
      hasText,
      strategy: page.strategy,
      // Do not include query text.
    },
  });

  return { results, nextCursor };
}

type Row = {
  id: string;
  client_generated_id: string;
  sender_id: string;
  created_at: Date | string;
  text_content: string | null;
  rank: number | string;
  type: string;
  media_id: string | null;
  sticker_id: string | null;
  doodle_id: string | null;
  has_thumbnail: boolean | null;
  duration_ms: number | string | null;
  is_reply: boolean | null;
};

async function runSearch(args: {
  conversationId: string;
  senderId: string | null;
  fromUtc: Date | null;
  toExclusive: Date | null;
  type: "all" | "text" | "links" | "photos" | "videos" | "voice" | "stickers" | "doodles" | "calls" | "music";
  text: string;
  mode: "phrase" | "terms";
  strategy: "fts" | "trgm" | "chrono";
  cursor: CursorPayload | null;
  limit: number;
}): Promise<{ rows: Row[]; strategy: string }> {
  const db = getDb();
  const filters: ReturnType<typeof sql>[] = [
    sql`m.conversation_id = ${args.conversationId}`,
    sql`m.deleted_at IS NULL`,
    sql`m.type IN ('text', 'image', 'video', 'audio', 'sticker', 'doodle', 'call')`,
  ];

  if (args.senderId) {
    filters.push(sql`m.sender_id = ${args.senderId}`);
  }
  if (args.fromUtc) {
    filters.push(sql`m.created_at >= ${args.fromUtc}`);
  }
  if (args.toExclusive) {
    filters.push(sql`m.created_at < ${args.toExclusive}`);
  }
  if (args.type === "links") {
    filters.push(sql`m.text_content ~* 'https?://'`);
  }
  if (args.type === "text") {
    filters.push(sql`m.type = 'text'`);
  }
  if (args.type === "photos") {
    filters.push(sql`m.type = 'image'`);
  }
  if (args.type === "videos") {
    filters.push(sql`m.type = 'video'`);
  }
  // Voice is not transcribed, so it is only ever reachable by filter, never by words.
  if (args.type === "voice") {
    filters.push(sql`m.type = 'audio'`);
  }
  // Sticker names are not FTS-indexed — type filter only.
  if (args.type === "stickers") {
    filters.push(sql`m.type = 'sticker'`);
  }
  if (args.type === "doodles") {
    filters.push(sql`m.type = 'doodle'`);
  }
  if (args.type === "calls") {
    filters.push(sql`m.type = 'call'`);
  }
  if (args.type === "music") {
    filters.push(sql`m.type = 'music'`);
  }

  if (args.strategy === "fts" && args.text) {
    const tsquery =
      args.mode === "phrase"
        ? sql`phraseto_tsquery('simple', ${args.text})`
        : sql`websearch_to_tsquery('simple', ${args.text})`;
    filters.push(sql`m.search_vector @@ ${tsquery}`);

    if (args.cursor) {
      const cAt = new Date(args.cursor.createdAt);
      filters.push(sql`(
        ts_rank_cd(m.search_vector, ${tsquery}) < ${args.cursor.rank}
        OR (
          ts_rank_cd(m.search_vector, ${tsquery}) = ${args.cursor.rank}
          AND (
            m.created_at < ${cAt}
            OR (m.created_at = ${cAt} AND m.id < ${args.cursor.id})
          )
        )
      )`);
    }

    const where = sql.join(filters, sql` AND `);
    const result = await db.execute(sql`
      SELECT m.id, m.client_generated_id, m.sender_id, m.created_at, m.text_content, m.type,
             (m.reply_to_message_id IS NOT NULL) AS is_reply,
             ts_rank_cd(m.search_vector, ${tsquery}) AS rank,
             mm.id AS media_id,
             m.sticker_id,
             dd.id AS doodle_id,
             (mm.thumbnail_storage_key IS NOT NULL) AS has_thumbnail,
             mm.duration_ms
      FROM messages m
      LEFT JOIN LATERAL (
        SELECT id, thumbnail_storage_key, duration_ms
        FROM message_media
        WHERE message_id = m.id
        ORDER BY sort_order ASC
        LIMIT 1
      ) mm ON true
      LEFT JOIN LATERAL (
        SELECT id
        FROM doodles
        WHERE message_id = m.id
        LIMIT 1
      ) dd ON true
      WHERE ${where}
      ORDER BY rank DESC, m.created_at DESC, m.id DESC
      LIMIT ${args.limit + 1}
    `);
    return { rows: result.rows as Row[], strategy: "fts" };
  }

  if (args.strategy === "trgm" && args.text) {
    // Indexed trigram similarity / ILIKE — conversation-scoped.
    const pattern = `%${args.text.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(sql`m.text_content ILIKE ${pattern} ESCAPE '\\'`);

    if (args.cursor) {
      const cAt = new Date(args.cursor.createdAt);
      filters.push(sql`(
        m.created_at < ${cAt}
        OR (m.created_at = ${cAt} AND m.id < ${args.cursor.id})
      )`);
    }

    const where = sql.join(filters, sql` AND `);
    const result = await db.execute(sql`
      SELECT m.id, m.client_generated_id, m.sender_id, m.created_at, m.text_content, m.type,
             (m.reply_to_message_id IS NOT NULL) AS is_reply,
             similarity(coalesce(m.text_content, ''), ${args.text}) AS rank,
             mm.id AS media_id,
             m.sticker_id,
             dd.id AS doodle_id,
             (mm.thumbnail_storage_key IS NOT NULL) AS has_thumbnail,
             mm.duration_ms
      FROM messages m
      LEFT JOIN LATERAL (
        SELECT id, thumbnail_storage_key, duration_ms
        FROM message_media
        WHERE message_id = m.id
        ORDER BY sort_order ASC
        LIMIT 1
      ) mm ON true
      LEFT JOIN LATERAL (
        SELECT id
        FROM doodles
        WHERE message_id = m.id
        LIMIT 1
      ) dd ON true
      WHERE ${where}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ${args.limit + 1}
    `);
    return { rows: result.rows as Row[], strategy: "trgm" };
  }

  // Filter-only chronological.
  if (args.cursor) {
    const cAt = new Date(args.cursor.createdAt);
    filters.push(sql`(
      m.created_at < ${cAt}
      OR (m.created_at = ${cAt} AND m.id < ${args.cursor.id})
    )`);
  }
  const where = sql.join(filters, sql` AND `);
  const result = await db.execute(sql`
    SELECT m.id, m.client_generated_id, m.sender_id, m.created_at, m.text_content, m.type,
           (m.reply_to_message_id IS NOT NULL) AS is_reply,
           0::float AS rank,
           mm.id AS media_id,
           m.sticker_id,
           dd.id AS doodle_id,
           (mm.thumbnail_storage_key IS NOT NULL) AS has_thumbnail,
           mm.duration_ms
    FROM messages m
    LEFT JOIN LATERAL (
      SELECT id, thumbnail_storage_key, duration_ms
      FROM message_media
      WHERE message_id = m.id
      ORDER BY sort_order ASC
      LIMIT 1
    ) mm ON true
    LEFT JOIN LATERAL (
      SELECT id
      FROM doodles
      WHERE message_id = m.id
      LIMIT 1
    ) dd ON true
    WHERE ${where}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ${args.limit + 1}
  `);
  return { rows: result.rows as Row[], strategy: "chrono" };
}
