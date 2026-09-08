import type { ChatMessage, MessagePage } from "@/lib/chat/types";
import { connectionManager } from "@/lib/connection/manager";
import { isClientHttpError, toApiClientError } from "@/lib/http/client-error";
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

export async function apiGetRecent(limit = 50): Promise<MessagePage> {
  return timed(async () => {
    const response = await fetch(`/api/messages?limit=${limit}`, { cache: "no-store" });
    return parse<MessagePage>(response);
  });
}

export async function apiGetBefore(cursor: string, limit = 50): Promise<MessagePage> {
  return timed(async () => {
    const response = await fetch(
      `/api/messages?before=${encodeURIComponent(cursor)}&limit=${limit}`,
      { cache: "no-store" },
    );
    return parse<MessagePage>(response);
  });
}

export async function apiGetAfter(cursor: string, limit = 100): Promise<MessagePage> {
  return timed(async () => {
    const response = await fetch(
      `/api/messages/sync?after=${encodeURIComponent(cursor)}&limit=${limit}`,
      { cache: "no-store" },
    );
    return parse<MessagePage>(response);
  });
}

export async function apiSendMessage(input: {
  text?: string;
  stickerId?: string;
  doodle?: import("@/lib/doodles/document").DoodleDocument;
  clientGeneratedId: string;
  replyToMessageId?: string;
  forceFail?: boolean;
}): Promise<ChatMessage> {
  return timed(async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (
      input.forceFail ||
      (typeof window !== "undefined" && window.sessionStorage.getItem("shhh.forceFail") === "1")
    ) {
      headers["x-shhh-force-fail"] = "1";
    }
    const response = await fetch("/api/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: input.stickerId || input.doodle ? undefined : input.text,
        stickerId: input.stickerId,
        doodle: input.doodle,
        clientGeneratedId: input.clientGeneratedId,
        replyToMessageId: input.replyToMessageId,
      }),
    });
    const body = await parse<{ message: ChatMessage }>(response);
    return body.message;
  });
}

export async function apiQueryReceipts(messageIds: string[]) {
  if (messageIds.length === 0) {
    return [] as Array<{
      messageId: string;
      deliveredAt: string | null;
      readAt: string | null;
    }>;
  }
  return timed(async () => {
    const response = await fetch("/api/messages/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds }),
    });
    const body = await parse<{
      receipts: Array<{
        messageId: string;
        deliveredAt: string | null;
        readAt: string | null;
      }>;
    }>(response);
    return body.receipts;
  });
}

export async function apiMarkDelivered(messageIds: string[]) {
  if (messageIds.length === 0) {
    return;
  }
  return timed(async () => {
    const response = await fetch("/api/messages/delivered", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds }),
    });
    return parse<{ updated: number }>(response);
  });
}

export async function apiMarkRead(messageIds: string[]) {
  if (messageIds.length === 0) {
    return;
  }
  return timed(async () => {
    const response = await fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds }),
    });
    return parse<{ updated: number }>(response);
  });
}

export type MessageContextPage = {
  target: ChatMessage;
  before: ChatMessage[];
  after: ChatMessage[];
  olderCursor: string | null;
  newerCursor: string | null;
};

export async function apiEditMessage(messageId: string, text: string): Promise<ChatMessage> {
  return timed(async () => {
    const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await parse<{ message: ChatMessage }>(response);
    return body.message;
  });
}

export async function apiDeleteMessage(messageId: string): Promise<ChatMessage> {
  return timed(async () => {
    const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
    const body = await parse<{ message: ChatMessage }>(response);
    return body.message;
  });
}

export async function apiSetReaction(messageId: string, emoji: string): Promise<ChatMessage> {
  return timed(async () => {
    const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const body = await parse<{ message: ChatMessage }>(response);
    return body.message;
  });
}

export async function apiClearReaction(messageId: string): Promise<ChatMessage> {
  return timed(async () => {
    const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}/reaction`, {
      method: "DELETE",
    });
    const body = await parse<{ message: ChatMessage }>(response);
    return body.message;
  });
}

export async function apiGetMessageContext(
  messageId: string,
  before = 30,
  after = 30,
): Promise<MessageContextPage> {
  return timed(async () => {
    const response = await fetch(
      `/api/messages/${encodeURIComponent(messageId)}/context?before=${before}&after=${after}`,
      { cache: "no-store" },
    );
    return parse<MessageContextPage>(response);
  });
}

// Search/History client helpers live in `@/lib/search/client-api` (stable client exports).
export {
  apiSearchMessages,
  apiHistoryMonth,
  apiHistoryDayFirst,
  apiHistoryAdjacent,
  type SearchResultItem,
} from "@/lib/search/client-api";
