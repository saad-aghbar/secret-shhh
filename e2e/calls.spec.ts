import { expect, test } from "@playwright/test";

import {
  applyCallPreview,
  expectCallHistory,
  openTwoUsers,
  startCall,
  waitForIncoming,
} from "./helpers/calls";
import { loginAs } from "./helpers/media";

test.describe("calls", () => {
  test.describe.configure({ mode: "default" });

  test("audio call both directions: decline, accept, history, refresh, minimize", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await expect(saad.getByTestId("outgoing-call")).toBeVisible();
      await expect(saad.getByLabel("Start audio call")).toHaveCount(1);
      await expect(saad.getByLabel("Cancel call")).toBeVisible();
      await expect(saad.getByLabel("Minimize call")).toBeVisible();
      await waitForIncoming(tala);
      await expect(tala.getByLabel("Answer audio call")).toBeVisible();
      await expect(tala.getByLabel("Decline call")).toBeVisible();

      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await expectCallHistory(tala, "Call declined");
      await expectCallHistory(saad, "Call declined");

      await startCall(tala, "audio");
      await waitForIncoming(saad);
      await saad.reload();
      await expect(saad.getByTestId("incoming-call")).toBeVisible({ timeout: 20_000 });
      await saad.getByTestId("accept-call").click();
      await expect(saad.getByTestId("call-surface")).toBeVisible();
      await expect(saad.getByTestId("call-surface")).toHaveAttribute(
        "data-call-status",
        /connecting|connected|failed/,
        { timeout: 15_000 },
      );

      if (await saad.getByTestId("call-surface").isVisible()) {
        await saad.getByTestId("minimize-call").click();
        await expect(saad.getByTestId("active-call-pill")).toBeVisible();
        await saad.getByTestId("active-call-pill").click();
        await expect(saad.getByTestId("call-surface")).toBeVisible();
        await saad.keyboard.press("Escape");
      }
      if (await saad.getByTestId("active-call-pill").isVisible()) {
        await saad.getByTestId("active-call-pill").click();
        await expect(saad.getByTestId("call-surface")).toBeVisible();
      }

      const end = saad.getByTestId("end-call").or(saad.getByTestId("close-failed-call"));
      if (await end.isVisible()) await end.click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("video call incoming does not require the camera before answer", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "video");
      await waitForIncoming(tala);
      await expect(tala.getByTestId("remote-video")).toHaveCount(0);
      await expect(tala.getByTestId("local-preview")).toHaveCount(0);
      await tala.getByTestId("accept-call").click();
      await expect(tala.getByTestId("call-surface")).toHaveAttribute("data-call-type", "video");
      const end = tala.getByTestId("end-call").or(tala.getByTestId("close-failed-call"));
      if (await end.isVisible()) await end.click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("second tab does not keep ringing after the call ends", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await loginAs(a, "Saad");
    await b.goto("/chat");
    await expect(b.getByTestId("start-audio-call")).toBeVisible();
    await startCall(a, "audio");
    await a.getByTestId("cancel-call").click();
    await expect(a.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
    await expect(b.getByTestId("incoming-call")).toHaveCount(0);
    await expect(b.getByTestId("outgoing-call")).toHaveCount(0);
    await context.close();
  });

  test("Low data toggle stays available on More", async ({ page }) => {
    await loginAs(page, "Saad");
    await page.goto("/more");
    await expect(page.getByRole("switch", { name: "Low data mode" })).toBeVisible();
    await expect(page.getByText(/Calls stay on audio-first quality/)).toBeVisible();
  });

  test("reconnect, weak network, and permission copy", async ({ page }) => {
    await loginAs(page, "Saad");
    await applyCallPreview(page, {
      type: "video",
      role: "caller",
      status: "reconnecting",
      network: "reconnecting",
    });
    await expect(page.getByText("Reconnecting…").first()).toBeVisible();
    await applyCallPreview(page, {
      type: "video",
      role: "caller",
      status: "connected",
      network: "weak",
    });
    await expect(page.getByText(/Connection is weak/)).toBeVisible();
    await expect(page.getByTestId("call-live-region")).toHaveText("Connection is weak");
    await applyCallPreview(page, {
      type: "audio",
      role: "caller",
      status: "connecting",
      permission: "denied",
    });
    await expect(page.getByText("Microphone access is off.")).toBeVisible();
  });
});
