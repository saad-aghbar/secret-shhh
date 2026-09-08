"use client";

import { averagePressure, strokePathD, strokePixelWidth } from "@/lib/doodles/geometry";
import type { DoodleDocument } from "@/lib/doodles/document";
import { parseDoodleDocumentLoose } from "@/lib/doodles/validation";
import { cn } from "@/lib/utils";

export const DOODLE_VIEW_WIDTH = 400;
export const DOODLE_VIEW_HEIGHT = 500;

type DoodleArtProps = {
  document?: DoodleDocument | null;
  label?: string;
  className?: string;
  decorative?: boolean;
  unavailable?: boolean;
  /** Cover crops 4:5 art into a square thumb. Meet is the default for chat/viewer. */
  fit?: "meet" | "cover";
};

export function DoodleArt({
  document,
  label = "Doodle",
  className,
  decorative = false,
  unavailable = false,
  fit = "meet",
}: DoodleArtProps) {
  const parsed = document ? parseDoodleDocumentLoose(document) : null;
  const broken = unavailable || (document != null && !parsed);

  if (broken) {
    return (
      <div
        data-testid="doodle-unavailable"
        className={cn(
          "shhh-doodle-paper text-muted-text flex items-center justify-center px-4 text-center text-[13px] font-medium",
          className,
        )}
      >
        Couldn&apos;t show this doodle.
      </div>
    );
  }

  const strokes = parsed?.strokes ?? [];

  return (
    <div className={cn("shhh-doodle-paper h-full w-full overflow-hidden", className)}>
      <svg
        viewBox={`0 0 ${DOODLE_VIEW_WIDTH} ${DOODLE_VIEW_HEIGHT}`}
        preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
        role={decorative ? "presentation" : "img"}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : label}
        className="block h-full w-full"
        data-testid="doodle-art"
      >
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={strokePathD(stroke, DOODLE_VIEW_WIDTH, DOODLE_VIEW_HEIGHT)}
            fill="none"
            stroke={stroke.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokePixelWidth(
              stroke,
              DOODLE_VIEW_WIDTH,
              DOODLE_VIEW_HEIGHT,
              averagePressure(stroke),
            )}
            opacity={stroke.opacity}
            style={stroke.tool === "marker" ? { mixBlendMode: "multiply" } : undefined}
          />
        ))}
      </svg>
    </div>
  );
}
