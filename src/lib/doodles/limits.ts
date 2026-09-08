export const DOODLE_VECTOR_VERSION = 1;
export const DOODLE_ASPECT_RATIO = 0.8;
export const DOODLE_BACKGROUND_MODE = "paper" as const;

export const MAX_STROKES = 400;
export const MAX_POINTS_PER_STROKE = 2_000;
export const MAX_TOTAL_POINTS = 12_000;
export const MAX_PAYLOAD_BYTES = 256 * 1024;
export const MAX_HISTORY = 80;

export const MIN_POINT_DISTANCE = 0.003;
export const RDP_EPSILON = 0.0012;

export const MIN_STROKE_WIDTH = 0.004;
export const MAX_STROKE_WIDTH = 0.12;
export const MIN_OPACITY = 0.08;
export const MAX_OPACITY = 1;

export const DEFAULT_PEN_WIDTH = 0.018;
export const DEFAULT_PEN_OPACITY = 1;
export const DEFAULT_MARKER_WIDTH = 0.055;
export const DEFAULT_MARKER_OPACITY = 0.38;
export const DEFAULT_ERASER_WIDTH = 0.062;

export const DOODLE_LIMIT_COPY = "This doodle is getting a little too big.";

export const DOODLE_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
