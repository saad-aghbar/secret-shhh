import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { sendDoodleMessage } from "@/lib/chat/send";
import { DoodleForbiddenError, DoodleNotFoundError, getDoodleForViewer } from "@/lib/doodles/service";
import { heartDocument } from "@/lib/doodles/fixtures";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 10 doodle authorization", () => {
  it("refuses unknown ids and forged conversation access", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    const message = await sendDoodleMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      document: heartDocument(),
      clientGeneratedId: randomUUID(),
    });
    expect(message.doodle?.id).toBeTruthy();

    await expect(
      getDoodleForViewer({
        doodleId: randomUUID(),
        userId: saad.user.id,
        conversationId: saad.conversationId,
      }),
    ).rejects.toBeInstanceOf(DoodleNotFoundError);

    await expect(
      getDoodleForViewer({
        doodleId: message.doodle!.id,
        userId: saad.user.id,
        conversationId: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(DoodleForbiddenError);
  });
});
