import { expect, test } from "@playwright/test";

import { openTwoUsers, startCall, waitForIncoming } from "./helpers/calls";
import { loginAs } from "./helpers/media";

test.describe("calls security", () => {
  test("rejects unauthenticated start and forged ids", async ({ page, request }) => {
    const anon = await request.post("/api/calls", {
      data: { type: "audio" },
    });
    expect(anon.status()).toBe(401);

    await loginAs(page, "Saad");
    const forged = await page.request.post("/api/calls/00000000-0000-0000-0000-000000000000/token");
    expect([404, 400, 403, 409]).toContain(forged.status());

    const arbitrary = await page.request.post("/api/calls/not-a-uuid/token");
    expect(arbitrary.status()).toBeGreaterThanOrEqual(400);
  });

  test("token is room-scoped and dies with the call", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      const live = await saad.request.get("/api/calls");
      expect(live.ok()).toBeTruthy();
      const body = (await live.json()) as { call: { id: string; roomName: string } | null };
      expect(body.call?.roomName.startsWith("shhh-call-")).toBe(true);

      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });

      const token = await saad.request.post(`/api/calls/${body.call?.id}/token`);
      expect([409, 404, 403]).toContain(token.status());
      if (token.ok()) {
        throw new Error("Ended call must not mint a token");
      }
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("duplicate accept and end converge", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      const active = (await (await saad.request.get("/api/calls")).json()) as {
        call: { id: string } | null;
      };
      const id = active.call?.id;
      expect(id).toBeTruthy();
      const first = await tala.request.post(`/api/calls/${id}/accept`);
      const second = await tala.request.post(`/api/calls/${id}/accept`);
      expect(first.ok()).toBeTruthy();
      expect(second.ok()).toBeTruthy();
      const endA = await saad.request.post(`/api/calls/${id}/end`);
      const endB = await tala.request.post(`/api/calls/${id}/end`);
      expect(endA.ok()).toBeTruthy();
      expect(endB.ok()).toBeTruthy();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });
});
