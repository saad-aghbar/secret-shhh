import { describe, expect, it } from "vitest";

import { asChatType, serializeMessage, tombstoneMessage } from "@/lib/chat/serialize";

describe("music serialization", () => {
  it("keeps music cards as their own type", () => {
    expect(asChatType("music")).toBe("music");
  });
});

describe("call serialization", () => {
  it("keeps call events as their own type", () => {
    expect(asChatType("call")).toBe("call");
    const message = serializeMessage(
      {
        id: "m1",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "g1",
        type: "call",
        textContent: "Audio call · 38 min",
        createdAt: new Date("2026-09-06T12:00:00.000Z"),
        editedAt: null,
        deletedAt: null,
        metadata: { callId: "c1", callType: "audio", outcome: "completed", durationMs: 38 * 60_000 },
      },
      null,
    );
    expect(message.type).toBe("call");
    expect(message.call?.outcome).toBe("completed");
  });
});

describe("tombstone serialization", () => {
  it("redacts content, media, receipts, and reactions", () => {
    const message = serializeMessage(
      {
        id: "m1",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "g1",
        type: "text",
        textContent: "secret",
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        editedAt: new Date("2026-09-01T12:01:00.000Z"),
        deletedAt: new Date("2026-09-01T12:02:00.000Z"),
      },
      { deliveredAt: new Date(), readAt: new Date() },
      [
        {
          id: "media-1",
          sortOrder: 0,
          mimeType: "image/jpeg",
          width: 10,
          height: 10,
          originalSizeBytes: 12,
          previewSizeBytes: null,
          originalFilename: "x.jpg",
          uploadStatus: "ready",
          hasPreview: true,
          hasThumbnail: true,
        },
      ],
      {
        reactions: [{ userId: "u2", emoji: "❤️", createdAt: "2026-09-01T12:00:00.000Z" }],
      },
    );
    expect(message.textContent).toBe("");
    expect(message.editedAt).toBeNull();
    expect(message.media).toBeUndefined();
    expect(message.reactions).toBeUndefined();
    expect(message.deliveredAt).toBeNull();
    expect(message.readAt).toBeNull();
    expect(message.deletedAt).toBe("2026-09-01T12:02:00.000Z");
  });

  it("keeps identity when locally tombstoned", () => {
    const next = tombstoneMessage(
      {
        id: "m1",
        conversationId: "c1",
        senderId: "u1",
        clientGeneratedId: "g1",
        type: "text",
        textContent: "hello",
        createdAt: "2026-09-01T12:00:00.000Z",
        editedAt: null,
        deletedAt: null,
        deliveredAt: null,
        readAt: null,
        reactions: [{ userId: "u1", emoji: "❤️", createdAt: "2026-09-01T12:00:00.000Z" }],
      },
      "2026-09-01T12:03:00.000Z",
    );
    expect(next.id).toBe("m1");
    expect(next.clientGeneratedId).toBe("g1");
    expect(next.textContent).toBe("");
    expect(next.reactions).toBeUndefined();
  });
});
