import { randomUUID } from "node:crypto";

import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import {
  acceptCall,
  cancelCall,
  declineCall,
  endCall,
  getActiveCall,
  getCallForUser,
  startCall,
  upgradeCallToVideo,
} from "@/lib/calls/service";
import { LIVE_CALL_STATUSES } from "@/lib/calls/config";
import { CallError } from "@/lib/calls/errors";
import { getDb } from "@/lib/db";
import { calls, loginThrottle, messages } from "@/lib/db/schema";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 12 calls integration", { timeout: 20_000 }, () => {
  const created: string[] = [];

  beforeEach(async () => {
    if (!canRun) return;
    const db = getDb();
    await db.delete(loginThrottle).where(like(loginThrottle.key, "call-start:%"));
    await db.delete(calls).where(inArray(calls.status, [...LIVE_CALL_STATUSES]));
  });

  afterAll(async () => {
    if (!canRun || created.length === 0) return;
    const db = getDb();
    for (const id of created) {
      await db.delete(calls).where(eq(calls.id, id));
    }
  });

  it("starts one live call, rejects a third identity, and is idempotent on accept", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    const first = await startCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      type: "audio",
    });
    created.push(first.id);
    expect(first.status).toBe("ringing");
    expect(first.role).toBe("caller");
    expect(first.roomName.startsWith("shhh-call-")).toBe(true);

    const double = await startCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      type: "video",
    });
    expect(double.id).toBe(first.id);

    await expect(
      getCallForUser({ userId: randomUUID(), callId: first.id }),
    ).rejects.toBeInstanceOf(CallError);

    const accepted = await acceptCall({
      requestId: randomUUID(),
      userId: tala.user.id,
      callId: first.id,
    });
    expect(accepted.status).toBe("connecting");
    const again = await acceptCall({
      requestId: randomUUID(),
      userId: tala.user.id,
      callId: first.id,
    });
    expect(again.status).toBe("connecting");
    expect(again.id).toBe(first.id);

    const ended = await endCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      callId: first.id,
    });
    expect(ended.status).toBe("completed");
    expect(await getActiveCall({ userId: saad.user.id, conversationId: saad.conversationId })).toBeNull();
  });

  it("declines and cancels write history events", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });

    const ringing = await startCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      type: "video",
    });
    created.push(ringing.id);
    const declined = await declineCall({
      requestId: randomUUID(),
      userId: tala.user.id,
      callId: ringing.id,
    });
    expect(declined.status).toBe("declined");

    const outgoing = await startCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      type: "audio",
    });
    created.push(outgoing.id);
    const cancelled = await cancelCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      callId: outgoing.id,
    });
    expect(cancelled.status).toBe("cancelled");

    const db = getDb();
    const events = await db
      .select({ type: messages.type, text: messages.textContent, metadata: messages.metadata })
      .from(messages)
      .where(eq(messages.conversationId, saad.conversationId));
    const titles = events.filter((row) => row.type === "call").map((row) => row.text);
    expect(titles.some((title) => title === "Call declined")).toBe(true);
    expect(titles.some((title) => title === "No answer")).toBe(true);
  });

  it("upgrades a connected audio call to video with metadata and is idempotent", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const tala = await bootstrapUserBySlot({ slot: "user_2", displayName: "Tala" });
    const stranger = randomUUID();

    const ringing = await startCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      type: "audio",
    });
    created.push(ringing.id);

    await expect(
      upgradeCallToVideo({
        requestId: randomUUID(),
        userId: saad.user.id,
        callId: ringing.id,
      }),
    ).rejects.toBeInstanceOf(CallError);

    await acceptCall({
      requestId: randomUUID(),
      userId: tala.user.id,
      callId: ringing.id,
    });

    await expect(
      upgradeCallToVideo({
        requestId: randomUUID(),
        userId: stranger,
        callId: ringing.id,
      }),
    ).rejects.toBeInstanceOf(CallError);

    const upgraded = await upgradeCallToVideo({
      requestId: randomUUID(),
      userId: saad.user.id,
      callId: ringing.id,
    });
    expect(upgraded.type).toBe("video");
    expect(upgraded.status).toBe("connecting");
    expect(upgraded.videoUpgradedBy).toBe(saad.user.id);
    expect(upgraded.roomName).toBe(ringing.roomName);

    const again = await upgradeCallToVideo({
      requestId: randomUUID(),
      userId: tala.user.id,
      callId: ringing.id,
    });
    expect(again.type).toBe("video");
    expect(again.videoUpgradedBy).toBe(saad.user.id);

    const ended = await endCall({
      requestId: randomUUID(),
      userId: saad.user.id,
      callId: ringing.id,
    });
    expect(ended.status).toBe("completed");
    await expect(
      upgradeCallToVideo({
        requestId: randomUUID(),
        userId: saad.user.id,
        callId: ringing.id,
      }),
    ).rejects.toBeInstanceOf(CallError);

    const db = getDb();
    const events = await db
      .select({ type: messages.type, text: messages.textContent, metadata: messages.metadata })
      .from(messages)
      .where(eq(messages.conversationId, saad.conversationId));
    const titles = events.filter((row) => row.type === "call").map((row) => row.text);
    expect(titles.some((title) => title?.startsWith("Video call"))).toBe(true);
  });
});
