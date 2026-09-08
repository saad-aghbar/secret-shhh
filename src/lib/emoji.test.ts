import { describe, expect, it } from "vitest";

import { firstGrapheme, isValidReactionEmoji, parseReactionEmoji } from "@/lib/emoji";

describe("reaction emoji validation", () => {
  it("accepts quick-tray and composed sequences", () => {
    for (const emoji of ["❤️", "😂", "🥺", "😮", "😭", "🔥", "🥰", "🫶", "💀", "🌚"]) {
      expect(isValidReactionEmoji(emoji), emoji).toBe(true);
    }
  });

  it("accepts skin-tone, ZWJ, and flag sequences", () => {
    expect(isValidReactionEmoji("👍🏽")).toBe(true);
    expect(isValidReactionEmoji("❤️‍🔥")).toBe(true);
    expect(isValidReactionEmoji("👩‍❤️‍👨")).toBe(true);
    expect(isValidReactionEmoji("🇵🇸")).toBe(true);
  });

  it("rejects empty, letters, and multiple graphemes", () => {
    expect(isValidReactionEmoji("")).toBe(false);
    expect(isValidReactionEmoji("a")).toBe(false);
    expect(isValidReactionEmoji("😂😂")).toBe(false);
    expect(isValidReactionEmoji("hello")).toBe(false);
    expect(isValidReactionEmoji("❤️ extra")).toBe(false);
  });

  it("never uses string.length === 1 as the rule", () => {
    expect("👍🏽".length).toBeGreaterThan(1);
    expect(isValidReactionEmoji("👍🏽")).toBe(true);
  });

  it("parses the first valid grapheme from native keyboard input", () => {
    expect(parseReactionEmoji("❤️")).toBe("❤️");
    expect(parseReactionEmoji(" 😂 ")).toBe("😂");
    expect(firstGrapheme("😂😂")).toBe("😂");
    expect(parseReactionEmoji("ab")).toBeNull();
  });
});
