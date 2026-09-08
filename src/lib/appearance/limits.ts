export const WALLPAPER_CONFIG_VERSION = 1;

export const MIN_BLUR = 0;
export const MAX_BLUR = 1;
export const MIN_DIM = 0;
export const MAX_DIM = 1;
export const MIN_OVERLAY = 0;
export const MAX_OVERLAY = 1;
export const MIN_FOCAL = 0;
export const MAX_FOCAL = 1;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export const DEFAULT_BLUR = 0;
export const DEFAULT_DIM = 0;
export const DEFAULT_OVERLAY = 0;
export const DEFAULT_FOCAL_X = 0.5;
export const DEFAULT_FOCAL_Y = 0.5;
export const DEFAULT_ZOOM = 1;

export const WALLPAPER_LONG_EDGE = 2048;
export const WALLPAPER_ENCODE_QUALITY = 0.86;
export const MAX_WALLPAPER_EDGE = 8_192;
export const MAX_WALLPAPER_BYTES = 6 * 1024 * 1024;
export const MAX_WALLPAPER_SOURCE_BYTES = 52_428_800;

export const WALLPAPER_UPLOAD_TTL_MS = 30 * 60 * 1000;
export const WALLPAPER_READ_URL_TTL_SECONDS = 6 * 60 * 60;

export const WALLPAPER_BLUR_PX = 28;
export const WALLPAPER_OVERSCALE = 1.08;

export const APPEARANCE_DRAFT_STORAGE_KEY = "shhh.appearance.draft";
export const APPEARANCE_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const CONSUMER_APPEARANCE_ERRORS = {
  INVALID: "Couldn't save this look.",
  PREPARE_FAILED: "Couldn't prepare this photo.",
  UNSUPPORTED_FORMAT: "This photo format isn't supported yet.",
  TOO_LARGE: "This photo is too large.",
  UPLOAD_FAILED: "Couldn't save this photo. Try again.",
  WAITING: "Waiting for connection",
  NOT_FOUND: "That background isn't here anymore.",
} as const;
