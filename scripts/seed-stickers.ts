/**
 * Seed ~60 stickers so the tray can be judged for scroll performance honestly.
 *
 * Usage: pnpm exec tsx scripts/seed-stickers.ts
 */
import { randomUUID } from "node:crypto";

import { bootstrapUserBySlot } from "../src/lib/auth/bootstrap";
import { resetStorageProviderCache } from "../src/lib/storage";
import { TINY_PNG } from "../src/lib/stickers/fixtures";
import { createSticker } from "../src/lib/stickers/service";

async function main() {
  const count = Number(process.argv[2] ?? 60);
  const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
  resetStorageProviderCache();
  process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? "test";

  for (let index = 0; index < count; index += 1) {
    await createSticker({
      requestId: randomUUID(),
      userId: saad.user.id,
      conversationId: saad.conversationId,
      bytes: TINY_PNG,
      declaredMime: "image/png",
      meta: {
        id: randomUUID(),
        name: `seed ${index + 1}`,
        animated: false,
        width: 512,
        height: 512,
      },
    });
  }
  console.info(`seeded ${count} stickers for ${saad.user.displayName}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
