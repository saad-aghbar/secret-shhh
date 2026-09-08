import { expect, test } from "@playwright/test";

test("private sections redirect when logged out", async ({ page }) => {
  await page.goto("/media");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/search");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/music");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/more");
  await expect(page).toHaveURL(/\/login/);
});
