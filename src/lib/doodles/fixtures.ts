import { newStrokeId, type DoodleDocument, type DoodleStroke } from "@/lib/doodles/document";
import { DOODLE_ASPECT_RATIO } from "@/lib/doodles/limits";

function line(
  color: string,
  points: Array<[number, number]>,
  tool: DoodleStroke["tool"] = "pen",
  width = 0.02,
  opacity = 1,
): DoodleStroke {
  const triples: number[] = [];
  for (const [x, y] of points) {
    triples.push(x, y, 0.5);
  }
  return {
    id: newStrokeId(),
    tool,
    color,
    width,
    opacity,
    points: triples,
  };
}

export function heartDocument(color = "#d9899c"): DoodleDocument {
  return {
    version: 1,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: "paper",
    strokes: [
      line(color, [
        [0.5, 0.72],
        [0.28, 0.5],
        [0.24, 0.36],
        [0.32, 0.26],
        [0.46, 0.3],
        [0.5, 0.4],
      ]),
      line(color, [
        [0.5, 0.4],
        [0.54, 0.3],
        [0.68, 0.26],
        [0.76, 0.36],
        [0.72, 0.5],
        [0.5, 0.72],
      ]),
    ],
  };
}

export function mixedToolDocument(): DoodleDocument {
  return {
    version: 1,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: "paper",
    strokes: [
      line("#4a756c", [
        [0.2, 0.2],
        [0.4, 0.25],
        [0.55, 0.4],
      ]),
      line(
        "#e4c15a",
        [
          [0.25, 0.55],
          [0.7, 0.55],
        ],
        "marker",
        0.06,
        0.38,
      ),
      line("#2a2622", [
        [0.3, 0.75],
        [0.65, 0.78],
      ]),
      line("#fffdf9", [
        [0.2, 0.82],
        [0.5, 0.84],
      ]),
    ],
  };
}

export function denseDocument(strokeCount = 120): DoodleDocument {
  const strokes: DoodleStroke[] = [];
  for (let i = 0; i < strokeCount; i += 1) {
    const y = 0.08 + (i / strokeCount) * 0.84;
    strokes.push(
      line("#4a756c", [
        [0.12, y],
        [0.35 + (i % 7) * 0.04, y + 0.01],
        [0.82, y],
      ]),
    );
  }
  return {
    version: 1,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: "paper",
    strokes,
  };
}
