import { and, eq, inArray, isNull } from "drizzle-orm";

import { authorizeConversationAccess } from "@/lib/chat/access";
import type { DoodleRef } from "@/lib/chat/types";
import { getDb, type Database } from "@/lib/db";
import { doodles, messages } from "@/lib/db/schema";
import {
  countPoints,
  payloadBytes,
  type DoodleDocument,
} from "@/lib/doodles/document";
import { DOODLE_VECTOR_VERSION } from "@/lib/doodles/limits";
import { parseDoodleDocument, tryParseStoredDocument } from "@/lib/doodles/validation";

export class DoodleNotFoundError extends Error {
  constructor(message = "Couldn't find that doodle.") {
    super(message);
    this.name = "DoodleNotFoundError";
  }
}

export class DoodleForbiddenError extends Error {
  constructor(message = "You can’t do that.") {
    super(message);
    this.name = "DoodleForbiddenError";
  }
}

type DoodleRow = typeof doodles.$inferSelect;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function toRef(row: DoodleRow): DoodleRef {
  const document = tryParseStoredDocument(row.vectorData);
  return {
    id: row.id,
    version: row.vectorVersion,
    aspectRatio: row.aspectRatio,
    backgroundMode: row.backgroundMode === "paper" ? "paper" : "paper",
    document:
      document.strokes.length > 0
        ? document
        : {
            version: 1,
            aspectRatio: row.aspectRatio || 0.8,
            backgroundMode: "paper",
            strokes: [],
          },
  };
}

export function toDoodleRef(row: DoodleRow): DoodleRef {
  return toRef(row);
}

export async function createDoodleForMessage(params: {
  tx: Transaction;
  creatorId: string;
  messageId: string;
  document: DoodleDocument;
}): Promise<DoodleRef> {
  const document = parseDoodleDocument(params.document);
  const [row] = await params.tx
    .insert(doodles)
    .values({
      creatorId: params.creatorId,
      messageId: params.messageId,
      vectorVersion: DOODLE_VECTOR_VERSION,
      vectorData: document,
      aspectRatio: document.aspectRatio,
      backgroundMode: document.backgroundMode,
      strokeCount: document.strokes.length,
      totalPoints: countPoints(document),
      payloadBytes: payloadBytes(document),
    })
    .returning();
  if (!row) {
    throw new Error("insert_failed");
  }
  return toRef(row);
}

export async function loadDoodlesForMessages(
  messageIds: Array<string | null | undefined>,
): Promise<Map<string, DoodleRef>> {
  const ids = [...new Set(messageIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, DoodleRef>();
  if (ids.length === 0) {
    return map;
  }
  const db = getDb();
  const rows = await db.select().from(doodles).where(inArray(doodles.messageId, ids));
  for (const row of rows) {
    if (row.messageId) {
      map.set(row.messageId, toRef(row));
    }
  }
  return map;
}

export async function getDoodleForViewer(params: {
  doodleId: string;
  userId: string;
  conversationId: string;
}): Promise<DoodleRef> {
  const allowed = await authorizeConversationAccess(params.userId, params.conversationId);
  if (!allowed) {
    throw new DoodleForbiddenError();
  }

  const db = getDb();
  const row = (
    await db
      .select({
        doodle: doodles,
        messageConversationId: messages.conversationId,
      })
      .from(doodles)
      .innerJoin(messages, eq(doodles.messageId, messages.id))
      .where(and(eq(doodles.id, params.doodleId), eq(messages.conversationId, params.conversationId)))
      .limit(1)
  )[0];

  if (!row) {
    throw new DoodleNotFoundError();
  }
  return toRef(row.doodle);
}

export async function cleanupUnreferencedDoodles(): Promise<{ deleted: number }> {
  const db = getDb();
  const orphans = await db.select({ id: doodles.id }).from(doodles).where(isNull(doodles.messageId));
  if (orphans.length === 0) {
    return { deleted: 0 };
  }
  const deleted = await db.delete(doodles).where(inArray(doodles.id, orphans.map((row) => row.id)));
  return { deleted: deleted.rowCount ?? orphans.length };
}
