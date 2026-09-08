import { z } from "zod";

import {
  countPoints,
  emptyDoodleDocument,
  payloadBytes,
  type DoodleDocument,
  type DoodleStroke,
  type DoodleTool,
} from "@/lib/doodles/document";
import {
  DOODLE_ASPECT_RATIO,
  DOODLE_BACKGROUND_MODE,
  DOODLE_LIMIT_COPY,
  DOODLE_VECTOR_VERSION,
  MAX_OPACITY,
  MAX_PAYLOAD_BYTES,
  MAX_POINTS_PER_STROKE,
  MAX_STROKE_WIDTH,
  MAX_STROKES,
  MAX_TOTAL_POINTS,
  MIN_OPACITY,
  MIN_STROKE_WIDTH,
} from "@/lib/doodles/limits";

export const SAFE_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const STROKE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class DoodleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoodleValidationError";
  }
}

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), { message: "Invalid number." });

export function isSafeHexColor(value: string): boolean {
  return SAFE_HEX_COLOR.test(value);
}

export function normalizeHexColor(value: string): string {
  return value.toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampCoord(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

export function clampPressure(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return clamp(value, 0, 1);
}

export function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return MIN_STROKE_WIDTH;
  return clamp(value, MIN_STROKE_WIDTH, MAX_STROKE_WIDTH);
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, MIN_OPACITY, MAX_OPACITY);
}

const pointTripleSchema = z
  .array(finiteNumber)
  .refine((points) => points.length >= 3 && points.length % 3 === 0, {
    message: "Stroke points must be x/y/pressure triples.",
  })
  .refine((points) => points.length / 3 <= MAX_POINTS_PER_STROKE, {
    message: DOODLE_LIMIT_COPY,
  });

const strokeSchema = z.object({
  id: z.string().regex(STROKE_ID, "Invalid stroke."),
  tool: z.enum(["pen", "marker"]),
  color: z.string().regex(SAFE_HEX_COLOR, "Invalid color."),
  width: finiteNumber,
  opacity: finiteNumber,
  points: pointTripleSchema,
});

const documentSchema = z
  .object({
    version: z.literal(DOODLE_VECTOR_VERSION),
    aspectRatio: finiteNumber,
    backgroundMode: z.literal(DOODLE_BACKGROUND_MODE),
    strokes: z.array(strokeSchema).max(MAX_STROKES, DOODLE_LIMIT_COPY),
  })
  .strict();

export function sanitizeStroke(input: DoodleStroke): DoodleStroke {
  const points: number[] = [];
  for (let i = 0; i + 2 < input.points.length; i += 3) {
    points.push(
      clampCoord(input.points[i]!),
      clampCoord(input.points[i + 1]!),
      clampPressure(input.points[i + 2]!),
    );
  }
  return {
    id: input.id,
    tool: input.tool,
    color: normalizeHexColor(input.color),
    width: clampWidth(input.width),
    opacity: clampOpacity(input.opacity),
    points,
  };
}

export function sanitizeDocument(input: DoodleDocument): DoodleDocument {
  return {
    version: DOODLE_VECTOR_VERSION,
    aspectRatio: DOODLE_ASPECT_RATIO,
    backgroundMode: DOODLE_BACKGROUND_MODE,
    strokes: input.strokes.map(sanitizeStroke),
  };
}

export function parseDoodleDocument(input: unknown): DoodleDocument {
  if (!input || typeof input !== "object") {
    throw new DoodleValidationError("Couldn't read this doodle.");
  }
  const record = input as Record<string, unknown>;
  if (record.version !== DOODLE_VECTOR_VERSION) {
    throw new DoodleValidationError("Couldn't show this doodle.");
  }
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first?.message === DOODLE_LIMIT_COPY) {
      throw new DoodleValidationError(DOODLE_LIMIT_COPY);
    }
    throw new DoodleValidationError("Couldn't read this doodle.");
  }

  const document = sanitizeDocument(parsed.data);
  if (countPoints(document) > MAX_TOTAL_POINTS) {
    throw new DoodleValidationError(DOODLE_LIMIT_COPY);
  }
  if (payloadBytes(document) > MAX_PAYLOAD_BYTES) {
    throw new DoodleValidationError(DOODLE_LIMIT_COPY);
  }
  if (!document.strokes.length) {
    throw new DoodleValidationError("Draw something first.");
  }
  return document;
}

export function parseDoodleDocumentLoose(input: unknown): DoodleDocument | null {
  try {
    if (!input || typeof input !== "object") return null;
    const record = input as Record<string, unknown>;
    if (record.version !== DOODLE_VECTOR_VERSION) return null;
    const parsed = documentSchema.safeParse(input);
    if (!parsed.success) return null;
    const document = sanitizeDocument(parsed.data);
    if (countPoints(document) > MAX_TOTAL_POINTS) return null;
    if (payloadBytes(document) > MAX_PAYLOAD_BYTES) return null;
    return document;
  } catch {
    return null;
  }
}

export function tryParseStoredDocument(input: unknown): DoodleDocument {
  return parseDoodleDocumentLoose(input) ?? emptyDoodleDocument();
}

export function isDoodleTool(value: unknown): value is DoodleTool {
  return value === "pen" || value === "marker";
}

export const sendDoodleSchema = z.object({
  doodle: z.unknown(),
  clientGeneratedId: z.uuid(),
  replyToMessageId: z.uuid().optional(),
  text: z.undefined().optional(),
  stickerId: z.undefined().optional(),
});
