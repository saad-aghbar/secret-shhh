import { describe, expect, it } from "vitest";

import { shouldShowMessageMeta } from "@/features/chat/chat-message-row";
import { MESSAGE_FIXTURE_LIST, MESSAGE_FIXTURES } from "@/lib/chat/fixtures";
import { buildChatRows, formatChatDateLabel, groupingFor } from "@/lib/chat/layout";
import type { ChatMessage } from "@/lib/chat/types";
import { presenceFromLastSeen, presenceLabel } from "@/lib/auth/presence";
import { backoffMs, MAX_AUTO_RETRIES } from "@/lib/sync/backoff";
import {
  mergeMessages,
  outgoingStatus,
  applyMessagePatch,
  reconcileCachedMessage,
  applyReceiptPatches,
  mutationKey,
  upsertMessage,
  type PendingMessage,
} from "@/lib/sync/merge";
import { messageActionFlags, summarizeReactions } from "@/lib/chat/message-actions";
import { graphemeLength } from "@/lib/text/graphemes";
import { isSafeHttpUrl, splitTextLinks } from "@/lib/text/links";
import { sendMessageSchema } from "@/lib/validation/chat";

function msg(
  partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "clientGeneratedId" | "textContent">,
): ChatMessage {
  return {
    conversationId: "c1",
    senderId: "u1",
    type: "text",
    createdAt: "2026-08-14T12:00:00.000Z",
    editedAt: null,
    deletedAt: null,
    deliveredAt: null,
    readAt: null,
    ...partial,
  };
}

describe("Unicode validation", () => {
  it("accepts English, Arabic, mixed, emoji, and URLs", () => {
    for (const text of MESSAGE_FIXTURE_LIST) {
      const parsed = sendMessageSchema.safeParse({
        text,
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
      });
      expect(parsed.success, text).toBe(true);
    }
  });

  it("rejects empty and whitespace-only", () => {
    expect(
      sendMessageSchema.safeParse({
        text: "   ",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });

  it("accepts a doodle payload without text", () => {
    const parsed = sendMessageSchema.safeParse({
      doodle: {
        version: 1,
        aspectRatio: 0.8,
        backgroundMode: "paper",
        strokes: [
          {
            id: "stroke-1",
            tool: "pen",
            color: "#4a756c",
            width: 0.02,
            opacity: 1,
            points: [0.1, 0.1, 0.5, 0.4, 0.4, 0.5],
          },
        ],
      },
      clientGeneratedId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid clientGeneratedId", () => {
    expect(
      sendMessageSchema.safeParse({
        text: "hello",
        clientGeneratedId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("counts grapheme clusters for emoji sequences", () => {
    expect(graphemeLength(MESSAGE_FIXTURES.emoji)).toBeLessThan(
      [...MESSAGE_FIXTURES.emoji].length + 3,
    );
    expect(graphemeLength("👨‍👩‍👧‍👦")).toBe(1);
  });
});

describe("link splitting", () => {
  it("keeps Arabic + URL readable as separate parts", () => {
    const parts = splitTextLinks(MESSAGE_FIXTURES.url);
    expect(parts.some((part) => part.kind === "url" && part.value === "https://example.com")).toBe(
      true,
    );
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("merge / dedup", () => {
  it("collapses optimistic + server copies of the same send", () => {
    const pending: PendingMessage[] = [
      {
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        conversationId: "c1",
        senderId: "u1",
        textContent: MESSAGE_FIXTURES.arabic,
        status: "sending",
        createdAt: "2026-08-14T12:00:00.000Z",
        retryCount: 0,
      },
    ];
    const cached = [
      msg({
        id: "server-1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: MESSAGE_FIXTURES.arabic,
      }),
    ];
    expect(mergeMessages(cached, pending)).toHaveLength(1);
  });

  it("keeps unique pending rows visible", () => {
    const pending: PendingMessage[] = [
      {
        clientGeneratedId: "22222222-2222-4222-8222-222222222222",
        conversationId: "c1",
        senderId: "u1",
        textContent: "queued",
        status: "queued",
        createdAt: "2026-08-14T12:01:00.000Z",
        retryCount: 0,
      },
    ];
    expect(mergeMessages([], pending)).toHaveLength(1);
  });

  it("maps outgoing receipt state", () => {
    const delivered = msg({
      id: "1",
      clientGeneratedId: "11111111-1111-4111-8111-111111111111",
      textContent: "hi",
      deliveredAt: "2026-08-14T12:02:00.000Z",
    });
    expect(outgoingStatus(delivered, undefined, true)).toBe("delivered");
    expect(
      outgoingStatus(delivered, undefined, true) === "delivered" ||
        outgoingStatus({ ...delivered, readAt: "2026-08-14T12:03:00.000Z" }, undefined, true) ===
          "read",
    ).toBe(true);
  });

  it("shows an uploading voice note as sending, not sent", () => {
    const local = msg({
      id: "11111111-1111-4111-8111-111111111133",
      clientGeneratedId: "11111111-1111-4111-8111-111111111133",
      textContent: "",
      type: "audio",
      uploadProgress: 40,
    });
    expect(outgoingStatus(local, undefined, true)).toBe("uploading");
    expect(outgoingStatus({ ...local, uploadProgress: -1 }, undefined, true)).toBe("failed");
    // Once finalized the server id differs from the client id and receipts win.
    expect(
      outgoingStatus(
        {
          ...local,
          id: "server-id",
          deliveredAt: "2026-08-14T12:02:00.000Z",
          uploadProgress: undefined,
        },
        undefined,
        true,
      ),
    ).toBe("delivered");
  });
});

describe("backoff", () => {
  it("stays within bounded delays", () => {
    for (let i = 0; i < MAX_AUTO_RETRIES + 2; i += 1) {
      const value = backoffMs(i);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(30_000);
    }
  });
});

describe("chat layout helpers", () => {
  it("labels today / yesterday in English", () => {
    const now = new Date("2026-08-14T15:00:00.000Z");
    expect(formatChatDateLabel("2026-08-14T01:00:00.000Z", now)).toBe("Today");
    expect(formatChatDateLabel("2026-08-13T01:00:00.000Z", now)).toBe("Yesterday");
  });

  it("groups consecutive same-sender messages", () => {
    const messages = [
      msg({
        id: "1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: "a",
        createdAt: "2026-08-14T12:00:00.000Z",
      }),
      msg({
        id: "2",
        clientGeneratedId: "11111111-1111-4111-8111-111111111112",
        textContent: "b",
        createdAt: "2026-08-14T12:00:30.000Z",
      }),
      msg({
        id: "3",
        clientGeneratedId: "11111111-1111-4111-8111-111111111113",
        textContent: "c",
        createdAt: "2026-08-14T12:01:00.000Z",
      }),
    ];
    expect(groupingFor(messages, 0)).toBe("first");
    expect(groupingFor(messages, 1)).toBe("middle");
    expect(groupingFor(messages, 2)).toBe("last");
    const rows = buildChatRows(messages);
    expect(rows.some((row) => row.kind === "date")).toBe(true);
  });
});

describe("presence labels", () => {
  it("maps online / recently active / offline", () => {
    expect(presenceFromLastSeen(new Date())).toBe("online");
    expect(presenceFromLastSeen(new Date(Date.now() - 2 * 60_000))).toBe("recently_active");
    expect(presenceFromLastSeen(new Date(Date.now() - 60 * 60_000))).toBe("offline");
    expect(presenceLabel("online")).toBe("Online");
    expect(presenceLabel("recently_active")).toBe("Recently active");
    expect(presenceLabel("offline")).toBe("Offline");
  });
});

describe("receipt patches", () => {
  it("updates deliveredAt / readAt on matching ids only", () => {
    const list = [
      msg({
        id: "1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: "a",
        deliveredAt: null,
        readAt: null,
      }),
      msg({
        id: "2",
        clientGeneratedId: "11111111-1111-4111-8111-111111111112",
        textContent: "b",
        deliveredAt: null,
        readAt: null,
      }),
    ];
    const next = applyReceiptPatches(list, [
      {
        messageId: "1",
        deliveredAt: "2026-08-14T12:05:00.000Z",
        readAt: "2026-08-14T12:06:00.000Z",
      },
    ]);
    expect(next[0]?.deliveredAt).toBe("2026-08-14T12:05:00.000Z");
    expect(next[0]?.readAt).toBe("2026-08-14T12:06:00.000Z");
    expect(next[1]?.deliveredAt).toBeNull();
    expect(outgoingStatus(next[0]!, undefined, true)).toBe("read");
  });

  it("does not clear existing receipts with null patches", () => {
    const list = [
      msg({
        id: "1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: "a",
        deliveredAt: "2026-08-14T12:05:00.000Z",
        readAt: "2026-08-14T12:06:00.000Z",
      }),
    ];
    const next = applyReceiptPatches(list, [{ messageId: "1", deliveredAt: null, readAt: null }]);
    expect(next).toBe(list);
    expect(next[0]?.readAt).toBe("2026-08-14T12:06:00.000Z");
  });

  it("returns same array reference when nothing changes", () => {
    const list = [
      msg({
        id: "1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: "a",
        deliveredAt: "2026-08-14T12:05:00.000Z",
      }),
    ];
    const next = applyReceiptPatches(list, [
      { messageId: "1", deliveredAt: "2026-08-14T12:05:00.000Z" },
    ]);
    expect(next).toBe(list);
  });
});

describe("merge older pages", () => {
  it("upserts older history without duplicating by id or clientGeneratedId", () => {
    const newer = msg({
      id: "2",
      clientGeneratedId: "11111111-1111-4111-8111-111111111112",
      textContent: "newer",
      createdAt: "2026-08-14T12:01:00.000Z",
    });
    const older = msg({
      id: "1",
      clientGeneratedId: "11111111-1111-4111-8111-111111111111",
      textContent: "older",
      createdAt: "2026-08-14T12:00:00.000Z",
    });
    const withOlder = upsertMessage([newer], older);
    const again = upsertMessage(withOlder, {
      ...newer,
      textContent: "newer duplicate payload",
    });
    expect(again.map((m) => m.id)).toEqual(["1", "2"]);
    expect(again.find((m) => m.id === "2")?.textContent).toBe("newer duplicate payload");
  });
});

describe("grouped quiet receipts", () => {
  it("shows quiet status only for last/single (showTime), not middle", () => {
    expect(shouldShowMessageMeta({ isOwn: true, showTime: false, status: "read" })).toBe(false);
    expect(shouldShowMessageMeta({ isOwn: true, showTime: true, status: "read" })).toBe(true);
    expect(shouldShowMessageMeta({ isOwn: true, showTime: true, status: "delivered" })).toBe(true);
    expect(shouldShowMessageMeta({ isOwn: true, showTime: true, status: "sent" })).toBe(true);
  });

  it("keeps exceptional failed/queued visible mid-group", () => {
    expect(shouldShowMessageMeta({ isOwn: true, showTime: false, status: "failed" })).toBe(true);
    expect(shouldShowMessageMeta({ isOwn: true, showTime: false, status: "queued" })).toBe(true);
  });

  it("buildChatRows keys stay on clientGeneratedId for settle stability", () => {
    const messages = [
      msg({
        id: "s1",
        clientGeneratedId: "11111111-1111-4111-8111-111111111111",
        textContent: "a",
        createdAt: "2026-08-14T12:00:00.000Z",
      }),
      msg({
        id: "s2",
        clientGeneratedId: "11111111-1111-4111-8111-111111111112",
        textContent: "b",
        createdAt: "2026-08-14T12:00:10.000Z",
      }),
    ];
    const rows = buildChatRows(messages).filter((row) => row.kind === "message");
    expect(rows.map((row) => row.key)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111112",
    ]);
    expect(rows[0]?.showTime).toBe(false);
    expect(rows[1]?.showTime).toBe(true);
  });
});

describe("message patches", () => {
  it("replaces an existing id in place so the newest id cannot change", () => {
    const older = msg({
      id: "1",
      clientGeneratedId: "11111111-1111-4111-8111-111111111111",
      textContent: "older",
      createdAt: "2026-08-14T12:00:00.000Z",
    });
    const newest = msg({
      id: "2",
      clientGeneratedId: "11111111-1111-4111-8111-111111111112",
      textContent: "newest",
      createdAt: "2026-08-14T12:01:00.000Z",
    });
    const patched = applyMessagePatch([older, newest], {
      ...newest,
      textContent: "edited newest",
      editedAt: "2026-08-14T12:02:00.000Z",
    });
    expect(patched[patched.length - 1]?.id).toBe("2");
    expect(patched[patched.length - 1]?.textContent).toBe("edited newest");
    expect(patched.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("collapses reaction set/clear onto one mutation key", () => {
    expect(mutationKey("reaction-set", "m1")).toBe(mutationKey("reaction-clear", "m1"));
    expect(mutationKey("edit", "m1")).not.toBe(mutationKey("delete", "m1"));
  });

  it("keeps the live row object when reconcile did not change the bubble", () => {
    const live = msg({
      id: "2",
      clientGeneratedId: "11111111-1111-4111-8111-111111111112",
      textContent: "voice",
      type: "audio",
    });
    expect(reconcileCachedMessage(live, { ...live })).toBe(live);
    const receipts = reconcileCachedMessage(live, { ...live, deliveredAt: "2026-08-14T12:03:00.000Z" });
    expect(receipts).not.toBe(live);
    expect(receipts.media).toBe(live.media);
    expect(receipts.deliveredAt).toBe("2026-08-14T12:03:00.000Z");
  });

  it("takes an incoming sticker archive, rename, or save flag", () => {
    const live = msg({
      id: "sticker-live",
      clientGeneratedId: "11111111-1111-4111-8111-111111111199",
      textContent: "",
      type: "sticker",
      sticker: {
        id: "11111111-1111-4111-8111-111111111188",
        name: "old",
        animated: false,
        width: 512,
        height: 512,
        archived: false,
        saved: false,
      },
    });
    const archived = reconcileCachedMessage(live, {
      ...live,
      sticker: { ...live.sticker!, archived: true },
    });
    expect(archived.sticker?.archived).toBe(true);
    const renamed = reconcileCachedMessage(live, {
      ...live,
      sticker: { ...live.sticker!, name: "قلب" },
    });
    expect(renamed.sticker?.name).toBe("قلب");
    const saved = reconcileCachedMessage(live, {
      ...live,
      sticker: { ...live.sticker!, saved: true },
    });
    expect(saved.sticker?.saved).toBe(true);
  });
});

describe("message action flags", () => {
  const ownText = msg({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    clientGeneratedId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    textContent: "hi",
    senderId: "u1",
  });

  it("lets the owner edit text and captions, but not voice", () => {
    expect(messageActionFlags(ownText, "u1").canEdit).toBe(true);
    expect(messageActionFlags({ ...ownText, type: "image" }, "u1").canEdit).toBe(true);
    expect(messageActionFlags({ ...ownText, type: "audio" }, "u1").canEdit).toBe(false);
    expect(messageActionFlags({ ...ownText, type: "doodle" }, "u1").canEdit).toBe(false);
    expect(messageActionFlags(ownText, "u2").canEdit).toBe(false);
  });

  it("refuses reply, react, edit, and delete on tombstones and unsent rows", () => {
    const tombstone = { ...ownText, deletedAt: "2026-08-14T12:02:00.000Z" };
    const pending = { ...ownText, id: ownText.clientGeneratedId };
    expect(messageActionFlags(tombstone, "u1")).toMatchObject({
      canReply: false,
      canReact: false,
      canEdit: false,
      canDelete: false,
    });
    expect(messageActionFlags(pending, "u1").canReply).toBe(false);
  });

  it("shows a count only when two people chose the same emoji", () => {
    const same = summarizeReactions(
      [
        { userId: "u1", emoji: "❤️", createdAt: "2026-08-14T12:00:00.000Z" },
        { userId: "u2", emoji: "❤️", createdAt: "2026-08-14T12:00:01.000Z" },
      ],
      "u1",
    );
    expect(same).toEqual([{ emoji: "❤️", count: 2, mine: true }]);
    const mixed = summarizeReactions(
      [
        { userId: "u1", emoji: "🥺", createdAt: "2026-08-14T12:00:00.000Z" },
        { userId: "u2", emoji: "😂", createdAt: "2026-08-14T12:00:01.000Z" },
      ],
      "u1",
    );
    expect(mixed.map((item) => item.emoji)).toEqual(["🥺", "😂"]);
    expect(mixed.every((item) => item.count === 1)).toBe(true);
  });
});
