import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/media";

test("unauthenticated chat redirects to login", async ({ page }) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Who’s here?" })).toBeVisible();
});

test("identity screen shows Saad and Tala", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Saad/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tala/i })).toBeVisible();
});

test("selecting Saad opens Saad password step", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Saad/i }).click();
  await expect(page.getByRole("heading", { name: "Hi Saad" })).toBeVisible();
  await expect(page.getByText("Enter your password")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("selecting Tala opens Tala password step", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Tala/i }).click();
  await expect(page.getByRole("heading", { name: "Hi Tala" })).toBeVisible();
});

test("wrong password shows failure without granting access", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Saad/i }).click();
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login/);
});

test("preferred profile shows This is you without granting access", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("shhh.preferredProfileSlot", "user_1");
  });
  await page.goto("/login");
  await expect(page.getByText("✓ This is you")).toBeVisible();
  await page.goto("/media");
  await expect(page).toHaveURL(/\/login/);
});

test("home redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("logout clears the previous identity’s local draft", async ({ page }) => {
  await loginAs(page, "Saad");
  await page.getByPlaceholder("Message…").fill("Saad private draft");
  await page.waitForTimeout(500);
  await page.goto("/more");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await loginAs(page, "Tala");
  await expect(page.getByPlaceholder("Message…")).not.toHaveValue("Saad private draft");
  const leftover = await page.evaluate(() => {
    const raw = sessionStorage.getItem("shhh.music.queue");
    if (!raw) return 0;
    try {
      return (JSON.parse(raw) as { items?: unknown[] }).items?.length ?? 0;
    } catch {
      return 0;
    }
  });
  expect(leftover).toBe(0);
});

test("health and robots stay public and empty of secrets", async ({ request, page }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const body = (await health.json()) as { ok?: boolean; version?: string };
  expect(body.ok).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(/SECRET|postgres:\/\//i);

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toMatch(/Disallow:\s*\//);

  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "This page isn’t here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Chat" })).toBeVisible();
});
