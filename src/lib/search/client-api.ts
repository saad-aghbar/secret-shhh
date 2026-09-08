/**
 * Client-only fetch helpers for Search / History.
 * Kept separate from chat sync/api so Turbopack never drops these exports mid-HMR.
 */
import type { ChatMessage } from "@/lib/chat/types";
import { isClientHttpError, toApiClientError } from "@/lib/http/client-error";
import { connectionManager } from "@/lib/connection/manager";
import type { ApiErrorBody } from "@/types/api";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    const error = body as ApiErrorBody;
    throw toApiClientError(error, response.status);
  }
  return body as T;
}

async function timed<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    connectionManager.reportSuccess(Date.now() - started);
    return result;
  } catch (error) {
    if (!isClientHttpError(error)) {
      connectionManager.reportFailure();
    }
    throw error;
  }
}

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
  stickerId?: string | null;
  doodleId?: string | null;
  hasThumbnail: boolean;
  durationMs?: number | null;
  isReply?: boolean;
};

export async function apiSearchMessages(params: {
  q?: string;
  sender?: string;
  from?: string;
  to?: string;
  type?: string;
  cursor?: string;
  limit?: number;
  tz?: string;
  signal?: AbortSignal;
}) {
  return timed(async () => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.sender) qs.set("sender", params.sender);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.type) qs.set("type", params.type);
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.tz) qs.set("tz", params.tz);
    const response = await fetch(`/api/search/messages?${qs.toString()}`, {
      cache: "no-store",
      signal: params.signal,
    });
    return parse<{ results: SearchResultItem[]; nextCursor: string | null }>(response);
  });
}

export async function apiHistoryMonth(year: number, month: number, tz: string) {
  return timed(async () => {
    const qs = new URLSearchParams({
      year: String(year),
      month: String(month),
      tz,
    });
    const response = await fetch(`/api/history/month?${qs}`, { cache: "no-store" });
    return parse<{ year: number; month: number; days: Array<{ date: string; count: number }> }>(
      response,
    );
  });
}

export async function apiHistoryDayFirst(date: string, tz: string) {
  return timed(async () => {
    const qs = new URLSearchParams({ date, tz });
    const response = await fetch(`/api/history/day/first?${qs}`, { cache: "no-store" });
    return parse<{ message: ChatMessage | null }>(response);
  });
}

export async function apiHistoryDayMessages(date: string, tz: string) {
  return timed(async () => {
    const qs = new URLSearchParams({ date, tz });
    const response = await fetch(`/api/history/day?${qs}`, { cache: "no-store" });
    return parse<{ date: string; messages: ChatMessage[] }>(response);
  });
}

export async function apiHistoryAdjacent(date: string, tz: string, dir: "prev" | "next") {
  return timed(async () => {
    const qs = new URLSearchParams({ date, tz, dir });
    const response = await fetch(`/api/history/day/adjacent?${qs}`, { cache: "no-store" });
    return parse<{ day: { date: string; count: number } | null }>(response);
  });
}
