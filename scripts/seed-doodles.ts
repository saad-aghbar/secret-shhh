import { randomUUID } from "node:crypto";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { sendDoodleMessage } from "@/lib/chat/send";
import { denseDocument, heartDocument, mixedToolDocument } from "@/lib/doodles/fixtures";

async function main() {
  const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
  const docs = [heartDocument(), mixedToolDocument(), denseDocument(60)];
  for (const document of docs) {
    const message = await sendDoodleMessage({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      document,
      clientGeneratedId: randomUUID(),
    });
    console.log(`seeded doodle ${message.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
