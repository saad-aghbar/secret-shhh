import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("stays discreet and installable", () => {
    const value = manifest();
    expect(value.name).toBe("Shhh");
    expect(value.short_name).toBe("Shhh");
    expect(value.id).toBe("/");
    expect(value.start_url).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.background_color).toBe("#f3efe8");
    expect(value.theme_color).toBe("#f3efe8");
    expect(value).not.toHaveProperty("description");
    expect(JSON.stringify(value)).not.toMatch(/Private Couple|Secret Messaging|Saad|Tala/i);
    expect(value.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(value.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(value.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
