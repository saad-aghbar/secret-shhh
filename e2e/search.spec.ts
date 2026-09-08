import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD ?? "000000";

async function loginAs(page: Page, name: "Saad" | "Tala") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });
}

async function apiSend(page: Page, text: string) {
  const ok = await page.evaluate(async (body) => {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, clientGeneratedId: crypto.randomUUID() }),
    });
    return response.ok;
  }, text);
  expect(ok).toBe(true);
}

test.describe("search and history", () => {
  test("English and Arabic search jump to chat with highlight", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const token = Date.now().toString(36);
    const english = `phase3 e2e love ${token}`;
    const arabic = `phase3 e2e بحبك ${token}`;
    await apiSend(page, english);
    await apiSend(page, arabic);

    await page.goto("/search");
    await expect(page.getByTestId("search-input")).toBeVisible();
    await page.getByTestId("search-input").fill("love");
    await expect(page.getByTestId("search-result").filter({ hasText: token })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("search-result").filter({ hasText: token }).first().click();
    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 15_000 });
    await expect(page.locator(`[data-highlighted="true"]`)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(english)).toBeVisible();
    await expect(page.getByTestId("jump-to-latest-wrap")).toHaveAttribute("data-active", "true");

    await page.getByTestId("jump-to-latest").click();
    await expect(page.locator('[data-testid="chat-experience"]')).toHaveAttribute(
      "data-historical",
      "false",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("jump-to-latest-wrap")).toHaveAttribute("data-active", "false", {
      timeout: 15_000,
    });

    await page.goto(`/search?q=${encodeURIComponent("بحبك")}`);
    await expect(page.getByTestId("search-result").filter({ hasText: token })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("filters stay draft until Apply; Clear and dismiss preserve applied", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.goto("/search");

    await page.getByTestId("search-filters-open").click();
    const sheet = page.getByTestId("shhh-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("filters-apply")).toBeVisible();
    // Sheet must portal above bottom nav (not trapped under tab transforms).
    const stacking = await sheet.evaluate((el) => {
      const nav = document.querySelector('nav[aria-label="Primary"]');
      const sheetZ = Number.parseInt(getComputedStyle(el).zIndex, 10);
      const navZ = nav ? Number.parseInt(getComputedStyle(nav).zIndex, 10) : 0;
      return {
        onBody: el.parentElement === document.body,
        aboveNav: Number.isFinite(sheetZ) && Number.isFinite(navZ) && sheetZ > navZ,
      };
    });
    expect(stacking.onBody).toBe(true);
    expect(stacking.aboveNav).toBe(true);
    await sheet.getByRole("button", { name: "Me", exact: true }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page).not.toHaveURL(/sender=me/);
    await sheet.getByTestId("filters-apply").evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page).toHaveURL(/sender=me/);
    await expect(page.getByTestId("filter-chip-sender")).toBeVisible();

    await page.getByTestId("search-filters-open").click();
    await page.getByTestId("filters-clear").evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page).toHaveURL(/sender=me/);
    await page.getByTestId("filters-apply").evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page).not.toHaveURL(/sender=me/);

    await page.getByTestId("search-filters-open").click();
    await page
      .getByTestId("shhh-sheet")
      .getByRole("button", { name: "Links", exact: true })
      .evaluate((el) => {
        (el as HTMLButtonElement).click();
      });
    await page.getByTestId("shhh-sheet-backdrop").click({ force: true });
    await expect(page).not.toHaveURL(/type=links/);
  });

  test("date range Apply writes from/to URL without native date inputs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.goto("/search");

    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await page.getByTestId("search-filters-open").click();
    const sheet = page.getByTestId("shhh-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("date-preset-today").click();
    await sheet.getByTestId("filters-apply").click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/);
    await expect(page).toHaveURL(/to=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByTestId("filter-chip-dates")).toBeVisible();
  });

  test("sheet small drag returns; large drag dismisses", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.goto("/search");
    await page.getByTestId("search-filters-open").click();
    const sheet = page.getByTestId("shhh-sheet");
    await expect(sheet).toHaveAttribute("data-state", "open");
    const handle = page.getByTestId("shhh-sheet-handle");
    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    await handle.dispatchEvent("pointerdown", {
      clientX: startX,
      clientY: startY,
      pointerId: 1,
      pointerType: "touch",
      buttons: 1,
    });
    await page.waitForTimeout(60);
    await page.evaluate(
      ({ x, y }) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { clientX: x, clientY: y, pointerId: 1, buttons: 1 }),
        );
      },
      { x: startX, y: startY + 40 },
    );
    await page.waitForTimeout(60);
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    });
    await expect(sheet).toHaveAttribute("data-state", "open");

    await handle.dispatchEvent("pointerdown", {
      clientX: startX,
      clientY: startY,
      pointerId: 1,
      pointerType: "touch",
      buttons: 1,
    });
    await page.waitForTimeout(60);
    await page.evaluate(
      ({ x, y }) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { clientX: x, clientY: y, pointerId: 1, buttons: 1 }),
        );
      },
      { x: startX, y: startY + 180 },
    );
    await page.waitForTimeout(60);
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    });
    await expect(sheet).toBeHidden({ timeout: 4_000 });
  });

  test("Back from chat restores search query and history month URL", async ({ page }) => {
    await loginAs(page, "Saad");
    const token = `back-${Date.now().toString(36)}`;
    await apiSend(page, `phase3 back ${token}`);

    await page.goto(`/search?q=${encodeURIComponent(token)}&sender=me`);
    await expect(page.getByTestId("search-result").filter({ hasText: token })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("search-result").filter({ hasText: token }).first().click();
    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 15_000 });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`q=${token}`));
    await expect(page).toHaveURL(/sender=me/);

    await page.goto("/search?tab=history&hy=2024&hm=6");
    await expect(page.getByTestId("history-calendar")).toBeVisible();
    await expect(page).toHaveURL(/hy=2024/);
    await expect(page).toHaveURL(/hm=6/);
    await page.getByTestId("search-tab-search").click();
    await page.getByTestId("search-tab-history").click();
    await expect(page).toHaveURL(/tab=history/);
  });

  test("missing focus message returns to search with calm copy", async ({ page }) => {
    await loginAs(page, "Saad");
    await page.goto("/chat?focus=00000000-0000-4000-8000-000000000000&from=search");
    await expect(page).toHaveURL(/\/more\/search\?.*unavailable=1/, { timeout: 15_000 });
    await expect(page.getByTestId("message-unavailable")).toContainText("isn't available anymore");
  });

  test("history day shows messages then row opens chat", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    const token = `hist-${Date.now().toString(36)}`;
    await apiSend(page, `phase3 history ${token}`);

    await page.goto("/search?tab=history");
    await expect(page.getByTestId("history-calendar")).toBeVisible();
    const today = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
    const todayCell = page.locator(`[data-testid="history-day"][data-date="${today}"]`);
    await expect(todayCell).toHaveAttribute("data-active", "true", { timeout: 15_000 });
    await todayCell.click();

    await expect(page).toHaveURL(/tab=history/);
    await expect(page).not.toHaveURL(/\/chat/);
    await expect(page.getByTestId("history-day-messages")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("history-day-message").filter({ hasText: token })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("history-day-message").filter({ hasText: token }).first().click();
    await expect(page).toHaveURL(/\/chat\?focus=/, { timeout: 15_000 });
    await expect(page.locator(`[data-highlighted="true"]`)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(`phase3 history ${token}`)).toBeVisible();
  });

  test("empty history day stays calm", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");
    await page.goto("/search?tab=history");
    const quiet = page.locator('[data-testid="history-day"][data-active="false"]').first();
    await expect(quiet).toBeVisible({ timeout: 15_000 });
    await quiet.click();
    await expect(page.getByText("Quiet day.")).toBeVisible();
    await expect(page).toHaveURL(/tab=history/);
    await expect(page).not.toHaveURL(/\/chat/);
  });

  test("desktop filters open floating panel and apply", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, "Saad");
    await page.goto("/search");

    await page.getByTestId("search-filters-open").click();
    await expect(page.getByTestId("filters-desktop-panel")).toBeVisible();
    await expect(page.getByTestId("shhh-sheet")).toHaveCount(0);
    await page
      .getByTestId("filters-desktop-panel")
      .getByRole("button", { name: "Me", exact: true })
      .evaluate((el) => (el as HTMLButtonElement).click());
    await page
      .getByTestId("filters-desktop-panel")
      .getByTestId("filters-apply")
      .evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page).toHaveURL(/sender=me/);
  });
});
