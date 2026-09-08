import { describe, expect, it } from "vitest";

import {
  isImageMediaFile,
  isVideoMediaFile,
  remainingSelectionNote,
  splitMediaSelection,
} from "@/features/chat/media-selection";

function file(name: string, type: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("splitMediaSelection", () => {
  it("returns empty for empty picks", () => {
    expect(splitMediaSelection([], "library")).toEqual([]);
  });

  it("collapses photos into one album in pick order", () => {
    const a = file("a.jpg", "image/jpeg");
    const b = file("b.png", "image/png");
    const result = splitMediaSelection([a, b], "library");
    expect(result).toEqual([{ kind: "photos", files: [a, b], origin: "library" }]);
  });

  it("caps albums at 10 and keeps leftover photos as another album", () => {
    const photos = Array.from({ length: 12 }, (_, index) => file(`p${index}.jpg`, "image/jpeg"));
    const result = splitMediaSelection(photos, "camera");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: "photos", origin: "camera" });
    expect(result[1]).toMatchObject({ kind: "photos", origin: "camera" });
    if (result[0]?.kind === "photos" && result[1]?.kind === "photos") {
      expect(result[0].files).toHaveLength(10);
      expect(result[1].files).toHaveLength(2);
    }
  });

  it("makes each video its own selection and keeps photos first", () => {
    const photo = file("still.jpg", "image/jpeg");
    const clipA = file("a.mp4", "video/mp4");
    const clipB = file("b.webm", "video/webm");
    const result = splitMediaSelection([clipA, photo, clipB], "library");
    expect(result).toEqual([
      { kind: "photos", files: [photo], origin: "library" },
      { kind: "video", file: clipA, origin: "library" },
      { kind: "video", file: clipB, origin: "library" },
    ]);
  });

  it("classifies by extension when MIME is empty", () => {
    const photo = file("holiday.HEIC", "");
    const clip = file("clip.MOV", "");
    expect(isImageMediaFile(photo)).toBe(true);
    expect(isVideoMediaFile(clip)).toBe(true);
    const result = splitMediaSelection([photo, clip], "library");
    expect(result).toHaveLength(2);
    expect(result[0]?.kind).toBe("photos");
    expect(result[1]?.kind).toBe("video");
  });

  it("ignores svg and unknown files", () => {
    const svg = file("x.svg", "image/svg+xml");
    const txt = file("note.txt", "text/plain");
    expect(splitMediaSelection([svg, txt], "library")).toEqual([]);
  });
});

describe("remainingSelectionNote", () => {
  it("is silent when nothing remains", () => {
    expect(remainingSelectionNote(0)).toBeUndefined();
  });

  it("uses honest sequential copy", () => {
    expect(remainingSelectionNote(1)).toBe("Videos send one at a time — 1 more after this.");
    expect(remainingSelectionNote(3)).toBe("Videos send one at a time — 3 more after this.");
  });
});
