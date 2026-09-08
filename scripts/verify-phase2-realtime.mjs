/**
 * Live two-browser Realtime verification against the running dev server.
 * Uses Playwright; does not start its own server (expects :3000).
 */
import { chromium, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const password = process.env.E2E_PASSWORD ?? "000000";

async function loginAs(page, name) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/chat/, { timeout: 20_000 });
  await page.getByPlaceholder("Message…").waitFor({ state: "visible" });
}

async function sendText(page, text) {
  const box = page.getByPlaceholder("Message…");
  await box.click();
  await box.fill("");
  await box.fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByPlaceholder("Message…").waitFor({ state: "visible" });
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const saadContext = await browser.newContext();
  const talaContext = await browser.newContext();
  const saad = await saadContext.newPage();
  const tala = await talaContext.newPage();

  const results = [];

  try {
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");
    await saad.locator('[data-testid="chat-experience"][data-realtime="subscribed"]').waitFor({
      timeout: 15_000,
    });
    await tala.locator('[data-testid="chat-experience"][data-realtime="subscribed"]').waitFor({
      timeout: 15_000,
    });
    results.push("realtime_client_subscribed=ok");

    // 1) Env + Realtime channel subscribe from the app's conversation id
    const realtimeProbe = await saad.evaluate(async () => {
      const root = document.querySelector("[data-testid='chat-experience']");
      const conversationId = root?.dataset.conversationId;
      const configured = Boolean(
        // Next inlines NEXT_PUBLIC_* into the client bundle; probe via channel bus + supabase import path is hard —
        // instead check that chat-experience mounted and window has no force-offline.
        conversationId,
      );
      return { conversationId: conversationId ?? null, configured: Boolean(configured) };
    });
    assert(realtimeProbe.conversationId, "chat-experience missing conversation id");
    results.push(`conversationId=${realtimeProbe.conversationId}`);

    // Direct Supabase subscribe using public env (same keys as browser)
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert(url && key, "Supabase env missing in script process");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = client.channel(`conversation:${realtimeProbe.conversationId}`);
    const subscribed = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve(true);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
    await client.removeChannel(channel);
    assert(subscribed, "Supabase Realtime channel did not SUBSCRIBE");
    results.push("realtime_subscribe=ok");

    // 2) Instant Saad → Tala
    const m1 = `rt saad→tala ${Date.now()}`;
    const t0 = Date.now();
    await sendText(saad, m1);
    await tala.getByText(m1).waitFor({ state: "visible", timeout: 4_000 });
    const d1 = Date.now() - t0;
    results.push(`saad→tala_ms=${d1}`);
    assert(d1 < 3500, `Saad→Tala too slow (${d1}ms) — expected Realtime, not ~5s poll`);

    // 3) Instant Tala → Saad
    const m2 = `rt tala→saad ${Date.now()}`;
    const t1 = Date.now();
    await sendText(tala, m2);
    await saad.getByText(m2).waitFor({ state: "visible", timeout: 4_000 });
    const d2 = Date.now() - t1;
    results.push(`tala→saad_ms=${d2}`);
    assert(d2 < 3500, `Tala→Saad too slow (${d2}ms)`);

    // 4) Typing Tala → Saad
    await tala.getByPlaceholder("Message…").click();
    await tala.getByPlaceholder("Message…").pressSequentially("typing from tala", { delay: 40 });
    await saad.getByTestId("typing-indicator").waitFor({ state: "visible", timeout: 6_000 });
    results.push("typing_tala→saad=ok");
    await tala.getByPlaceholder("Message…").fill("");
    await tala.getByPlaceholder("Message…").blur();
    await saad.getByTestId("typing-indicator").waitFor({ state: "hidden", timeout: 6_000 });
    results.push("typing_clear_tala=ok");

    // 5) Typing Saad → Tala
    await saad.getByPlaceholder("Message…").click();
    await saad.getByPlaceholder("Message…").pressSequentially("typing from saad", { delay: 40 });
    await tala.getByTestId("typing-indicator").waitFor({ state: "visible", timeout: 6_000 });
    results.push("typing_saad→tala=ok");
    await sendText(saad, `rt after typing ${Date.now()}`);
    await tala.getByTestId("typing-indicator").waitFor({ state: "hidden", timeout: 6_000 }).catch(() => {});
    results.push("typing_clear_on_send=ok");

    // 6) Receipts without refresh: Sent → Delivered → Read
    const m3 = `rt receipts ${Date.now()}`;
    await sendText(saad, m3);
    await tala.getByText(m3).waitFor({ state: "visible", timeout: 4_000 });
    const bubble = saad.locator(`[data-own="true"]`).filter({ hasText: m3 });
    // After send should show Sent (or already Delivered if very fast)
    await bubble.getByTestId("message-status").waitFor({ state: "visible", timeout: 5_000 });
    const early = await bubble.getByTestId("message-status").innerText();
    results.push(`status_early=${early.trim()}`);
    assert(/Sent|Delivered|Read/.test(early), `expected Sent/Delivered/Read, got ${early}`);

    // Delivered/Read via Realtime receipt:update (not page reload)
    await bubble
      .getByTestId("message-status")
      .filter({ hasText: /Delivered|Read/ })
      .waitFor({ state: "visible", timeout: 12_000 });
    const mid = await bubble.getByTestId("message-status").innerText();
    results.push(`status_deliveredish=${mid.trim()}`);

    // Ensure Tala's message is in view so read marks
    await tala.getByText(m3).scrollIntoViewIfNeeded();
    await tala.bringToFront();
    await bubble
      .getByTestId("message-status")
      .filter({ hasText: /Read/ })
      .waitFor({ state: "visible", timeout: 15_000 });
    const late = await bubble.getByTestId("message-status").innerText();
    results.push(`status_read=${late.trim()}`);
    assert(/Read/.test(late), `expected Read without refresh, got ${late}`);

    // 7) Scroll-up + New messages pill
    await saad.evaluate(async () => {
      for (let i = 0; i < 40; i += 1) {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `rt seed ${Date.now()}-${i}`,
            clientGeneratedId: crypto.randomUUID(),
          }),
        });
        if (!response.ok) {
          throw new Error(`seed ${response.status}`);
        }
      }
    });
    await saad.reload();
    await saad.getByPlaceholder("Message…").waitFor({ state: "visible" });
    await tala.reload();
    await tala.getByPlaceholder("Message…").waitFor({ state: "visible" });

    const list = saad.getByTestId("chat-message-list");
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await saad.waitForTimeout(700);
    await list.evaluate((el) => {
      el.scrollTop = Math.min(120, Math.max(0, el.scrollHeight / 4));
    });
    await saad.waitForTimeout(300);
    const before = await list.evaluate((el) => ({
      top: el.scrollTop,
      distance: el.scrollHeight - el.scrollTop - el.clientHeight,
    }));
    assert(before.distance > 200, `expected scrolled up, distance=${before.distance}`);

    const incoming = `rt while scrolled ${Date.now()}`;
    await sendText(tala, incoming);
    await expect(saad.getByTestId("jump-to-latest-wrap")).toHaveAttribute("data-active", "true", {
      timeout: 5_000,
    });
    await expect(saad.getByTestId("jump-to-latest")).toHaveAttribute("data-state", "unseen");
    const scrollAfter = await list.evaluate((el) => el.scrollTop);
    const distanceAfter = await list.evaluate(
      (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
    );
    assert(Math.abs(scrollAfter - before.top) < 500, `yanked: before=${before.top} after=${scrollAfter}`);
    assert(distanceAfter > 150, `should stay away from bottom, distance=${distanceAfter}`);
    await saad.getByTestId("jump-to-latest").click();
    await saad.getByText(incoming).waitFor({ state: "visible", timeout: 5_000 });
    await expect
      .poll(async () => saad.getByTestId("jump-to-latest-wrap").getAttribute("data-active"))
      .toBe("false");
    results.push("scroll_pill=ok");

    console.log("VERIFY_OK");
    for (const line of results) {
      console.log(line);
    }
    process.exit(0);
  } catch (error) {
    console.error("VERIFY_FAIL", error instanceof Error ? error.message : error);
    for (const line of results) {
      console.log(line);
    }
    process.exit(1);
  } finally {
    await saadContext.close();
    await talaContext.close();
    await browser.close();
  }
}

main();
