import { afterEach, describe, expect, it, vi } from "vitest";

import { lockPageScroll } from "@/components/shhh/scroll-lock";

/**
 * The node test environment has no DOM, so stand up just enough of one: the
 * lock only ever touches documentElement.style and the window scroll position.
 */
function installDom(scrollY = 240) {
  const style: Record<string, string> = { overflow: "", position: "", top: "", width: "" };
  const scrolledTo: number[] = [];
  vi.stubGlobal("document", { documentElement: { style } });
  vi.stubGlobal("window", {
    scrollY,
    scrollTo: (_x: number, y: number) => scrolledTo.push(y),
  });
  return { style, scrolledTo };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("page scroll lock", () => {
  it("locks the page and restores the exact scroll position", () => {
    const { style, scrolledTo } = installDom(512);

    const release = lockPageScroll();
    expect(style.position).toBe("fixed");
    expect(style.top).toBe("-512px");

    release();
    expect(style.position).toBe("");
    expect(style.overflow).toBe("");
    expect(scrolledTo).toEqual([512]);
  });

  it("survives overlapping overlays: the page unlocks only after the last release", () => {
    const { style } = installDom(120);

    // A sheet is still playing its exit while the next overlay mounts.
    const first = lockPageScroll();
    const second = lockPageScroll();

    first();
    expect(style.position).toBe("fixed");

    second();
    expect(style.position).toBe("");
    expect(style.top).toBe("");
  });

  it("ignores a double release rather than unbalancing the count", () => {
    const { style } = installDom();

    const first = lockPageScroll();
    const second = lockPageScroll();
    first();
    first();
    expect(style.position).toBe("fixed");

    second();
    expect(style.position).toBe("");
  });
});
