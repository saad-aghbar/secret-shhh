import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { getConversationPartnerId } from "@/lib/chat/access";
import { hydrateMessages } from "@/lib/chat/queries";
import type { ChatMessage } from "@/lib/chat/types";
import { formatZonedDate, monthRangeUtc, zonedDayBounds } from "@/lib/history/timezone";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";

export type MonthDayActivity = {
  date: string;
  count: number;
};

export async function getMonthActivity(params: {
  conversationId: string;
  year: number;
  month: number;
  timeZone: string;
}): Promise<MonthDayActivity[]> {
  const { start, nextStart } = monthRangeUtc(params.year, params.month, params.timeZone);
  const db = getDb();

  // One query for the month; group by local calendar date in the requested tz.
  const result = await db.execute(sql`
    SELECT to_char((m.created_at AT TIME ZONE ${params.timeZone}), 'YYYY-MM-DD') AS day,
           count(*)::int AS count
    FROM messages m
    WHERE m.conversation_id = ${params.conversationId}
      AND m.deleted_at IS NULL
      AND m.type IN ('text', 'image', 'video', 'audio', 'sticker', 'doodle', 'call')
      AND m.created_at >= ${start}
      AND m.created_at < ${nextStart}
    GROUP BY day
    ORDER BY day ASC
  `);

  return (result.rows as Array<{ day: string; count: number }>).map((row) => ({
    date: row.day,
    count: Number(row.count),
  }));
}

export async function getFirstMessageOnDay(params: {
  conversationId: string;
  viewerId: string;
  date: string;
  timeZone: string;
}): Promise<ChatMessage | null> {
  const rows = await getMessagesOnDay({ ...params, limit: 1 });
  return rows[0] ?? null;
}

const DAY_MESSAGES_CAP = 100;

/**
 * Messages on a local calendar day for History preview.
 * Returns up to the most recent DAY_MESSAGES_CAP messages, oldest→newest within that window
 * so busy days still surface what was said late in the day.
 */
export async function getMessagesOnDay(params: {
  conversationId: string;
  viewerId: string;
  date: string;
  timeZone: string;
  limit?: number;
}): Promise<ChatMessage[]> {
  const limit = Math.min(params.limit ?? DAY_MESSAGES_CAP, DAY_MESSAGES_CAP);
  const { start, nextStart } = zonedDayBounds(params.date, params.timeZone);
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, params.conversationId),
        inArray(messages.type, ["text", "image", "video", "audio", "sticker", "doodle", "call"]),
        gte(messages.createdAt, start),
        lt(messages.createdAt, nextStart),
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);

  rows.reverse();

  const partnerId = await getConversationPartnerId(params.conversationId, params.viewerId);
  return hydrateMessages(rows, params.viewerId, partnerId);
}

export async function getAdjacentActiveDay(params: {
  conversationId: string;
  date: string;
  timeZone: string;
  dir: "prev" | "next";
}): Promise<{ date: string; count: number } | null> {
  const { start, nextStart } = zonedDayBounds(params.date, params.timeZone);
  const db = getDb();

  if (params.dir === "prev") {
    const result = await db.execute(sql`
      SELECT to_char((m.created_at AT TIME ZONE ${params.timeZone}), 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM messages m
      WHERE m.conversation_id = ${params.conversationId}
        AND m.deleted_at IS NULL
        AND m.type IN ('text', 'image', 'video', 'audio', 'sticker', 'doodle', 'call')
        AND m.created_at < ${start}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 1
    `);
    const row = (result.rows as Array<{ day: string; count: number }>)[0];
    return row ? { date: row.day, count: Number(row.count) } : null;
  }

  const result = await db.execute(sql`
    SELECT to_char((m.created_at AT TIME ZONE ${params.timeZone}), 'YYYY-MM-DD') AS day,
           count(*)::int AS count
    FROM messages m
    WHERE m.conversation_id = ${params.conversationId}
      AND m.deleted_at IS NULL
      AND m.type IN ('text', 'image', 'video', 'audio', 'sticker', 'doodle', 'call')
      AND m.created_at >= ${nextStart}
    GROUP BY day
    ORDER BY day ASC
    LIMIT 1
  `);
  const row = (result.rows as Array<{ day: string; count: number }>)[0];
  return row ? { date: row.day, count: Number(row.count) } : null;
}

/** Exported for tests — local date of a UTC instant. */
export function messageLocalDate(iso: string, timeZone: string) {
  return formatZonedDate(new Date(iso), timeZone);
}
