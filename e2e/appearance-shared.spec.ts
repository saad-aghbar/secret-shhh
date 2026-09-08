import { expect, test } from "@playwright/test";

import {
  applySharedColor,
  loginAndOpenAppearance,
  openAppearance,
  wallpaperSource,
  wallpaperType,
} from "./helpers/appearance";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("appearance shared", () => {
  test("shared wallpaper reaches the partner and personal override wins", async ({ browser }) => {
    test.setTimeout(120_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);

    await loginAs(saad, "Saad");
    await loginAndOpenAppearance(tala, "Tala");
    // Saad's later Appearance visit must keep Tala's shared wallpaper.
    await applySharedColor(tala, "clay");

    await saad.goto("/chat");
    await saad.reload();
    await expect(saad.getByTestId("wallpaper-layer")).toBeVisible();
    expect(await wallpaperType(saad)).toBe("solid");
    expect(await wallpaperSource(saad)).toBe("shared");

    await openAppearance(saad, { reset: false });
    await saad.getByTestId("appearance-preset-blush").click();
    await saad.getByTestId("appearance-apply").click();
    await expect(saad.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
    await saad.goto("/chat");
    expect(await wallpaperSource(saad)).toBe("personal");

    await tala.goto("/chat");
    await tala.reload();
    expect(await wallpaperSource(tala)).toBe("shared");

    await saadContext.close();
    await talaContext.close();
  });
});
