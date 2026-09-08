import { describe, expect, it } from "vitest";

import { isWeakArtistName, splitTitleArtist } from "@/lib/music/providers/youtube";

describe("YouTube title/artist split", () => {
  it("splits Artist - Title", () => {
    expect(splitTitleArtist("Rick Astley - Never Gonna Give You Up (Official Video)", "")).toEqual({
      artistName: "Rick Astley",
      title: "Never Gonna Give You Up (Official Video)",
    });
  });

  it("uses the channel when the title has no dash", () => {
    expect(splitTitleArtist("Never Gonna Give You Up (Official Video) (4K Remaster)", "Rick Astley")).toEqual({
      artistName: "Rick Astley",
      title: "Never Gonna Give You Up (Official Video) (4K Remaster)",
    });
  });

  it("strips Topic and VEVO suffixes from the channel", () => {
    expect(splitTitleArtist("Yellow", "Coldplay - Topic").artistName).toBe("Coldplay");
    expect(splitTitleArtist("Song", "RickAstleyVEVO").artistName).toBe("RickAstley");
  });

  it("marks empty channels as unknown", () => {
    expect(isWeakArtistName("Unknown artist")).toBe(true);
    expect(splitTitleArtist("A song", "").artistName).toBe("Unknown artist");
  });
});
