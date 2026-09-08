import { expect, test } from "@playwright/test";

import { hideDocument, openPrivacy, showDocument, unlockShhh } from "./helpers/privacy";
import { loginAs, password } from "./helpers/media";

test.describe("privacy", () => {
  test("toggles persist and never prompt for notifications", async ({ page }) => {
    await openPrivacy(page);
    await expect(page.getByTestId("discreet-mode")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("show-app-badge")).toHaveAttribute("aria-checked", "false");
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/api/preferences") &&
        response.request().method() === "PATCH" &&
        response.ok(),
    );
    await page.getByTestId("lock-on-leave").click();
    await saved;
    await expect(page.getByTestId("lock-on-leave")).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await expect(page.getByTestId("lock-on-leave")).toHaveAttribute("aria-checked", "false");
    const restored = page.waitForResponse(
      (response) =>
        response.url().includes("/api/preferences") &&
        response.request().method() === "PATCH" &&
        response.ok(),
    );
    await page.getByTestId("lock-on-leave").click();
    await restored;

    const permission = await page.evaluate(() =>
      "Notification" in window ? Notification.permission : "default",
    );
    expect(permission).not.toBe("granted");
    const badgeSet = await page.evaluate(() => {
      const nav = navigator as Navigator & { setAppBadge?: unknown };
      return typeof nav.setAppBadge;
    });
    expect(badgeSet === "function" || badgeSet === "undefined").toBe(true);
  });

  test("quick lock hides the thread until the password is entered", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "Saad");
    await expect(page.getByTestId("chat-experience")).toBeVisible();
    await page.goto("/more");
    await page.getByTestId("quick-lock").click();
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    await expect(page.getByTestId("chat-experience")).toHaveCount(0);
    await page.getByTestId("lock-screen").getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password");
    await page.getByTestId("unlock-shhh").click();
    await expect(page.getByTestId("lock-screen").getByRole("alert")).toHaveText(
      "That password isn’t right.",
    );
    await unlockShhh(page, password);
    await expect(page.getByTestId("lock-screen")).toHaveCount(0, { timeout: 15_000 });
    await page.goto("/chat");
    await expect(page.getByTestId("chat-experience")).toBeVisible();
  });

  test("a short hide does not lock; a long hide does", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "Saad");
    await hideDocument(page);
    await expect(page.getByTestId("privacy-cover")).toBeVisible();
    await page.waitForTimeout(2_000);
    await showDocument(page);
    await expect(page.getByTestId("privacy-cover")).toHaveCount(0);
    await expect(page.getByTestId("lock-screen")).toHaveCount(0);

    await hideDocument(page);
    await page.waitForTimeout(16_000);
    await showDocument(page);
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    const chatBehindLock = await page.evaluate(() => {
      const chat = document.querySelector("[data-testid='chat-experience']");
      if (!chat) return true;
      return Boolean(chat.closest("[inert]"));
    });
    expect(chatBehindLock).toBe(true);
    const lockedFocus = await page.evaluate(() => {
      const lock = document.querySelector("[data-testid='lock-screen']");
      const active = document.activeElement;
      return Boolean(lock && active && lock.contains(active));
    });
    expect(lockedFocus).toBe(true);
    await unlockShhh(page);
    await expect(page.getByTestId("lock-screen")).toHaveCount(0, { timeout: 15_000 });
  });

  test("a reload while locked never paints the thread", async ({ page }) => {
    await loginAs(page, "Saad");
    await page.goto("/more");
    await page.getByTestId("quick-lock").click();
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    await expect(page.getByTestId("chat-experience")).toHaveCount(0);
    await expect(page.getByTestId("chat-message-list")).toHaveCount(0);
  });
});
