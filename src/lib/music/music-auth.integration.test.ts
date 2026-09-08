import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { bootstrapUserBySlot } from "@/lib/auth/bootstrap";
import { MusicError } from "@/lib/music/errors";
import { getPlaylistDetail, getTrackDetail } from "@/lib/music/service";

const canRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!canRun)("phase 15 music authorization", () => {
  it("denies unknown tracks and playlists", async () => {
    const saad = await bootstrapUserBySlot({ slot: "user_1", displayName: "Saad" });
    await expect(getTrackDetail(saad.conversationId, saad.user.id, randomUUID())).rejects.toBeInstanceOf(
      MusicError,
    );
    await expect(getPlaylistDetail(saad.conversationId, saad.user.id, randomUUID())).rejects.toBeInstanceOf(
      MusicError,
    );
    await expect(getTrackDetail(randomUUID(), saad.user.id, randomUUID())).rejects.toBeInstanceOf(MusicError);
  });
});
