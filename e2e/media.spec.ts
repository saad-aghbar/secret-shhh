import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const password = process.env.E2E_PASSWORD ?? "000000";
const fixtureJpeg = path.join(__dirname, "fixtures", "tiny.jpg");
const fixturePng = path.join(__dirname, "fixtures", "tiny.png");

async function loginAs(page: Page, name: "Saad" | "Tala") {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });
}

async function sendPhoto(page: Page, file: string, caption: string) {
  await page.getByTestId("photo-attach").click();
  await page.getByTestId("media-input").setInputFiles(file);
  await expect(page.getByTestId("photo-selection")).toBeVisible();
  await page.getByTestId("photo-caption").fill(caption);
  await page.getByTestId("photo-send").click();
  await expect(page.getByText(caption)).toBeVisible({ timeout: 45_000 });
}

test.describe("shared media library", () => {
  test("persisted photos appear in Media after reload and open viewer", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    const marker = `media-lib-${Date.now()}`;
    await sendPhoto(page, fixtureJpeg, marker);
    await expect(page.getByTestId("photo-bubble").filter({ hasText: marker })).toBeVisible();

    await page.goto("/media");
    await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("media-grid").getByTestId("media-thumb").first()).toBeVisible();
    await expect(page.getByText("Nothing shared yet")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 30_000 });
    const thumbs = page.getByTestId("media-grid").getByTestId("media-thumb");
    await expect(thumbs.first()).toBeVisible();
    await thumbs.first().click();
    await expect(page.getByTestId("photo-viewer")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
  });

  test("album contributes all photos to Media grid", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "Saad");

    const marker = `media-album-${Date.now()}`;
    await page.getByTestId("photo-attach").click();
    await page.getByTestId("media-input").setInputFiles([fixtureJpeg, fixturePng, fixtureJpeg]);
    await expect(page.getByTestId("photo-selection")).toBeVisible();
    await page.getByTestId("photo-caption").fill(marker);
    await page.getByTestId("photo-send").click();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 60_000 });

    await page.goto("/media");
    await expect(page.getByTestId("media-grid")).toBeVisible({ timeout: 30_000 });
    const count = await page.getByTestId("media-grid").getByTestId("media-thumb").count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
