import { expect, test, type Browser, type Page } from "@playwright/test";

import { revealLatestCaption, scrollChatToLatest } from "./helpers/media";

const password = process.env.E2E_PASSWORD ?? "000000";

async function loginAs(page: Page, name: "Saad" | "Tala") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });
  await expect(page.getByPlaceholder("Message…")).toBeVisible();
  await scrollChatToLatest(page);
}

async function openTwoUsers(browser: Browser) {
  const saadContext = await browser.newContext();
  const talaContext = await browser.newContext();
  const saad = await saadContext.newPage();
  const tala = await talaContext.newPage();
  await loginAs(saad, "Saad");
  await loginAs(tala, "Tala");
  // Prefer Realtime when configured; don't fail if still connecting.
  await Promise.all([
    saad
      .locator('[data-testid="chat-experience"][data-realtime="subscribed"]')
      .waitFor({ timeout: 12_000 })
      .catch(() => undefined),
    tala
      .locator('[data-testid="chat-experience"][data-realtime="subscribed"]')
      .waitFor({ timeout: 12_000 })
      .catch(() => undefined),
  ]);
  return { saad, tala, saadContext, talaContext };
}

async function seedMessages(page: Page, count: number, prefix: string) {
  await page.evaluate(
    async ({ count: n, prefix: label }) => {
      for (let i = 0; i < n; i += 1) {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${label} ${i}`,
            clientGeneratedId: crypto.randomUUID(),
          }),
        });
        if (!response.ok) {
          throw new Error(`seed failed: ${response.status}`);
        }
      }
    },
    { count, prefix },
  );
  await page.reload();
  await expect(page.getByPlaceholder("Message…")).toBeVisible();
}

async function sendText(page: Page, text: string) {
  const box = page.getByPlaceholder("Message…");
  await box.click();
  await box.fill("");
  await box.fill(text);
  await expect(box).toHaveValue(text);
  const send = page.getByRole("button", { name: "Send", exact: true });
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
  await expect(box).toHaveValue("", { timeout: 10_000 });
  await scrollChatToLatest(page);
}

test.describe("chat", () => {
  // Independent tests — avoid serial abort cascading when one flakes.
  test.describe.configure({ mode: "default" });

  test("authenticated chat shows composer", async ({ page }) => {
    await loginAs(page, "Saad");
    const box = page.getByPlaceholder("Message…");
    await expect(box).toBeVisible();
    // The trailing control is the message: silence records, words send.
    await expect(page.getByTestId("voice-start")).toBeVisible();
    await box.fill("hello");
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  });

  test("English send appears optimistically", async ({ page }) => {
    await loginAs(page, "Saad");
    const text = `e2e english ${Date.now()}`;
    await sendText(page, text);
    await expect(page.getByText(text)).toBeVisible();
  });

  test("Arabic and mixed messages render", async ({ page }) => {
    await loginAs(page, "Saad");
    const stamp = Date.now();
    for (const text of [`اشتقتلك ${stamp}`, `بحبك so much ${stamp}`, `I love you كتير ${stamp}`]) {
      await sendText(page, text);
      await expect(page.getByTestId("chat-message-list").getByText(text)).toBeVisible();
    }
  });

  test("mobile viewport chat chrome", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Tala");
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    const composer = page.getByPlaceholder("Message…");
    await expect(composer).toBeInViewport();
  });

  test("draft restores after reload and clears on send", async ({ page }) => {
    await loginAs(page, "Saad");
    const draft = `e2e draft ${Date.now()}`;
    await page.getByPlaceholder("Message…").fill(draft);
    await expect.poll(async () => page.getByPlaceholder("Message…").inputValue()).toBe(draft);
    // Allow Dexie write to settle.
    await page.waitForTimeout(200);
    await page.reload();
    await expect(page.getByPlaceholder("Message…")).toHaveValue(draft, { timeout: 15_000 });
    await sendText(page, draft);
    await expect(page.getByText(draft)).toBeVisible();
    await expect(page.getByPlaceholder("Message…")).toHaveValue("");
  });

  test("Saad and Tala drafts stay isolated", async ({ browser }) => {
    test.setTimeout(90_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    const saadDraft = `saad draft ${Date.now()}`;
    const talaDraft = `tala draft ${Date.now()}`;
    await saad.getByPlaceholder("Message…").fill(saadDraft);
    await tala.getByPlaceholder("Message…").fill(talaDraft);
    await saad.waitForTimeout(200);
    await tala.waitForTimeout(200);
    await saad.reload();
    await tala.reload();
    await expect(saad.getByPlaceholder("Message…")).toHaveValue(saadDraft, { timeout: 15_000 });
    await expect(tala.getByPlaceholder("Message…")).toHaveValue(talaDraft, { timeout: 15_000 });
    await saadContext.close();
    await talaContext.close();
  });

  test("offline queue then reconnect shows one copy to partner", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    await saadContext.setOffline(true);
    const text = `e2e offline ${Date.now()}`;
    await sendText(saad, text);
    await expect(saad.getByText(text)).toBeVisible();
    await expect(saad.getByText(/Queued|Sending/i).first()).toBeVisible();
    await saadContext.setOffline(false);
    await revealLatestCaption(tala, text, 60_000);
    await expect(tala.getByText(text)).toHaveCount(1);
    await expect(saad.locator(`[data-client-id]`).filter({ hasText: text })).toHaveCount(1);
    await saadContext.close();
    await talaContext.close();
  });

  test("reconnect catches missed messages without dupes", async ({ browser }) => {
    test.setTimeout(90_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    await saadContext.setOffline(true);
    const first = `e2e miss a ${Date.now()}`;
    const second = `e2e miss b ${Date.now()}`;
    await sendText(tala, first);
    await sendText(tala, second);
    await expect(tala.getByText(first)).toBeVisible();
    await expect(tala.getByText(second)).toBeVisible();
    await saadContext.setOffline(false);
    await revealLatestCaption(saad, first, 25_000);
    await revealLatestCaption(saad, second, 25_000);
    await expect(saad.getByText(first)).toHaveCount(1);
    await expect(saad.getByText(second)).toHaveCount(1);
    await saadContext.close();
    await talaContext.close();
  });

  test("two users exchange a message", async ({ browser }) => {
    test.setTimeout(90_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    const text = `e2e hello tala ${Date.now()}`;
    await sendText(saad, text);
    await expect(saad.getByText(text)).toBeVisible();
    await revealLatestCaption(tala, text, 35_000);
    await saadContext.close();
    await talaContext.close();
  });

  test("delivered / read status appears for sender via poll path", async ({ browser }) => {
    test.setTimeout(90_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    const text = `e2e receipt ${Date.now()}`;
    await sendText(saad, text);
    await expect(saad.getByText(text)).toBeVisible();
    await revealLatestCaption(tala, text, 35_000);
    const bubble = saad.locator(`[data-own="true"]`).filter({ hasText: text });
    await expect(bubble.getByTestId("message-status")).toContainText(/Delivered|Read/, {
      timeout: 35_000,
    });
    await saadContext.close();
    await talaContext.close();
  });

  test("failed send retries with same client id", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, "Saad");
    await page.evaluate(() => sessionStorage.setItem("shhh.forceFail", "1"));
    const text = `e2e fail retry ${Date.now()}`;
    await sendText(page, text);
    await scrollChatToLatest(page);
    await expect(page.getByTestId("message-retry")).toBeVisible({ timeout: 15_000 });
    const clientId = await page
      .locator(`[data-client-id]`)
      .filter({ hasText: text })
      .getAttribute("data-client-id");
    expect(clientId).toBeTruthy();
    await page.evaluate(() => sessionStorage.removeItem("shhh.forceFail"));
    const retry = page.getByTestId("message-retry");
    await expect(retry).toBeVisible();
    // Force: list virtualization / receipt updates can detach the button mid-click.
    await retry.click({ force: true });
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByTestId("message-retry")).toHaveCount(0, { timeout: 15_000 });
    const row = page.locator(`[data-own="true"]`).filter({ hasText: text });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-client-id", clientId!);
    await expect(row).toHaveAttribute("data-status", /sent|delivered|read/, { timeout: 20_000 });
  });

  test("State A down arrow appears when scrolled up without unseen", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "Saad");
    await seedMessages(page, 40, `e2e arrow ${Date.now()}`);
    const list = page.getByTestId("chat-message-list");
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    await list.evaluate((el) => {
      el.scrollTop = Math.min(80, el.scrollHeight / 5);
    });
    const wrap = page.getByTestId("jump-to-latest-wrap");
    await expect(wrap).toHaveAttribute("data-active", "true", { timeout: 10_000 });
    await expect(page.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "arrow");
    await page.getByTestId("jump-to-latest").click();
    await expect
      .poll(async () =>
        list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 120),
      )
      .toBe(true);
    await expect(wrap).toHaveAttribute("data-active", "false", { timeout: 10_000 });
  });

  test("scroll-up not yanked; jump control upgrades then glides to latest", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    const prefix = `e2e seed ${Date.now()}`;
    await seedMessages(saad, 55, prefix);
    await tala.reload();
    await expect(tala.getByPlaceholder("Message…")).toBeVisible();

    const list = saad.getByTestId("chat-message-list");
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await saad.waitForTimeout(800);
    await list.evaluate((el) => {
      el.scrollTop = Math.min(120, Math.max(0, el.scrollHeight / 4));
    });
    await expect
      .poll(async () =>
        list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight > 400),
      )
      .toBe(true);

    const wrap = saad.getByTestId("jump-to-latest-wrap");
    await expect(wrap).toHaveAttribute("data-active", "true");
    await expect(saad.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "arrow");

    const scrollBefore = await list.evaluate((el) => el.scrollTop);
    const incoming = `e2e new while scrolled ${Date.now()}`;
    await sendText(tala, incoming);

    await expect(saad.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "unseen", {
      timeout: 25_000,
    });
    await expect(saad.getByTestId("jump-to-latest")).toContainText(/1 new message/i);
    const scrollAfter = await list.evaluate((el) => el.scrollTop);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(400);

    const mid = await list.evaluate((el) => el.scrollTop);
    await saad.getByTestId("jump-to-latest").click();
    // Smooth glide: position should change toward bottom over time (not only teleport).
    await expect
      .poll(async () =>
        list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 150),
      )
      .toBe(true);
    expect(Math.abs((await list.evaluate((el) => el.scrollTop)) - mid)).toBeGreaterThan(50);
    await expect(saad.getByText(incoming)).toBeVisible();
    await expect(wrap).toHaveAttribute("data-active", "false", { timeout: 10_000 });
    await saadContext.close();
    await talaContext.close();
  });

  test("grouped outgoing shows quiet Read only on last bubble", async ({ page }) => {
    await loginAs(page, "Saad");
    const stamp = Date.now();
    const texts = Array.from({ length: 5 }, (_, i) => `e2e group ${stamp} ${i}`);
    for (const text of texts) {
      await sendText(page, text);
    }
    for (const text of texts) {
      await expect(page.getByTestId("chat-message-list").getByText(text)).toBeVisible();
    }
    // Only the last in the rapid group should expose message-status among these five
    // once they settle to Sent (or later). Middles must not each show Read/Sent.
    const groupRows = page.locator(`[data-own="true"]`).filter({ hasText: `e2e group ${stamp}` });
    await expect(groupRows).toHaveCount(5);
    const statuses = groupRows.getByTestId("message-status");
    await expect(statuses).toHaveCount(1, { timeout: 15_000 });
    await expect(groupRows.last().getByTestId("message-status")).toBeVisible();
  });

  test("typing indicator via mocked realtime test bus", async ({ page }) => {
    await loginAs(page, "Saad");
    await expect(page.getByTestId("chat-experience")).toBeVisible();
    const indicator = page.getByTestId("typing-indicator");
    await expect(indicator).toHaveAttribute("data-active", "false");
    await page.evaluate(() => {
      const root = document.querySelector("[data-testid='chat-experience']") as HTMLElement;
      const conversationId = root.dataset.conversationId!;
      const userId = root.dataset.userId!;
      const partnerId = `${userId}-partner`;
      const bus = window.__shhhRealtimeTestBus;
      if (!bus) {
        throw new Error("realtime test bus missing");
      }
      bus.publish(conversationId, "typing:start", { userId: partnerId });
    });
    await expect(indicator).toHaveAttribute("data-active", "true");
    // Compact incoming bubble only — not a full-width strip.
    const bubble = indicator.locator(".bg-incoming-bubble");
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toHaveClass(/w-fit/);
    await page.evaluate(() => {
      const root = document.querySelector("[data-testid='chat-experience']") as HTMLElement;
      const conversationId = root.dataset.conversationId!;
      const userId = root.dataset.userId!;
      window.__shhhRealtimeTestBus?.publish(conversationId, "typing:stop", {
        userId: `${userId}-partner`,
      });
    });
    await expect(indicator).toHaveAttribute("data-active", "false", { timeout: 5_000 });
  });

  test("logout still protects chat", async ({ page }) => {
    await loginAs(page, "Saad");
    await page.goto("/more");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login/);
  });
});
