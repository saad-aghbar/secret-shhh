import { describe, expect, it } from "vitest";

import { buildReplyPreview, snippetFromText } from "@/lib/chat/reply-preview";

describe("reply snippets", () => {
  it("keeps short Arabic and mixed text intact", () => {
    expect(snippetFromText("هاي حبيبي")).toBe("هاي حبيبي");
    expect(snippetFromText("hello هاي")).toBe("hello هاي");
  });

  it("truncates on grapheme boundaries, including emoji", () => {
    const long = `${"ن".repeat(80)}❤️`;
    const snippet = snippetFromText(long, 10);
    expect(snippet?.endsWith("…")).toBe(true);
    expect([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(snippet!)].length).toBe(
      11,
    );
  });

  it("returns a deleted placeholder without leaking content", () => {
    const preview = buildReplyPreview({
      id: "m1",
      senderId: "u1",
      type: "text",
      textContent: "secret",
      deletedAt: new Date().toISOString(),
    });
    expect(preview.deleted).toBe(true);
    expect(preview.textSnippet).toBeNull();
    expect(preview.mediaPreviewId).toBeNull();
  });
});
