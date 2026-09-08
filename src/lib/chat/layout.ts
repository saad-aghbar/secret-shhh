import { GROUP_WINDOW_MS, type BubbleGroup } from "@/lib/chat/types";
import type { ChatMessage } from "@/lib/chat/types";

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const longDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatMessageTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

export function formatChatDateLabel(iso: string, now = new Date()): string {
  const date = startOfDay(new Date(iso));
  const today = startOfDay(now);
  const delta = today.getTime() - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (delta === 0) {
    return "Today";
  }
  if (delta === day) {
    return "Yesterday";
  }
  if (delta > 0 && delta < 7 * day) {
    return weekday.format(date);
  }
  return longDate.format(date);
}

export function sameDay(a: string, b: string) {
  return startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
}

export function groupingFor(messages: ChatMessage[], index: number): BubbleGroup {
  const current = messages[index];
  if (!current || current.type === "call") {
    return "single";
  }
  const prev = messages[index - 1];
  const next = messages[index + 1];
  const withPrev = Boolean(
    prev &&
      prev.type !== "call" &&
      prev.senderId === current.senderId &&
      sameDay(prev.createdAt, current.createdAt) &&
      new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime() <= GROUP_WINDOW_MS,
  );
  const withNext = Boolean(
    next &&
      next.type !== "call" &&
      next.senderId === current.senderId &&
      sameDay(next.createdAt, current.createdAt) &&
      new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime() <= GROUP_WINDOW_MS,
  );
  if (withPrev && withNext) {
    return "middle";
  }
  if (withPrev) {
    return "last";
  }
  if (withNext) {
    return "first";
  }
  return "single";
}

export type ChatRow =
  | { kind: "date"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: ChatMessage;
      group: BubbleGroup;
      showTime: boolean;
    };

export function buildChatRows(messages: ChatMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    const prev = messages[index - 1];
    if (!prev || !sameDay(prev.createdAt, message.createdAt)) {
      rows.push({
        kind: "date",
        key: `date-${message.createdAt.slice(0, 10)}`,
        label: formatChatDateLabel(message.createdAt),
      });
    }
    const group = groupingFor(messages, index);
    rows.push({
      kind: "message",
      key: message.clientGeneratedId,
      message,
      group,
      showTime: group === "single" || group === "last",
    });
  }
  return rows;
}
