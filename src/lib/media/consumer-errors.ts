/** Consumer-safe photo/video error copy — never expose internal validation jargon. */
export const CONSUMER_PHOTO_ERRORS = {
  PREPARE_FAILED: "Couldn't prepare this photo.",
  UNSUPPORTED_FORMAT: "This photo format isn't supported yet.",
  TOO_LARGE: "This photo is too large to send.",
  SEND_FAILED: "Couldn't send · Tap to retry",
  CHOOSE_AGAIN: "Choose the photo again to retry.",
  EMPTY_FILE: "That file looks empty.",
  REJECTED_TYPE: "That file type isn't supported.",
} as const;

export const CONSUMER_VIDEO_ERRORS = {
  PREPARE_FAILED: "Couldn't prepare this video.",
  UNSUPPORTED_FORMAT: "This video format isn't supported yet.",
  TOO_LARGE: "This video is too large to send.",
  SEND_FAILED: "Couldn't send · Tap to retry",
  CHOOSE_AGAIN: "Choose the video again to continue.",
  CAMERA_GONE: "This clip was recorded in Shhh. After a refresh it can't be sent again.",
  DIFFERENT_FILE: "That's a different video. Choose the same one to continue.",
  PLAYBACK: "Couldn't play this video.",
  UNSUPPORTED_PLAYBACK: "This video can't be played in this browser.",
  WAITING: "Waiting for connection",
} as const;

export const CONSUMER_AUDIO_ERRORS = {
  MIC_DENIED: "Microphone access is off.",
  MIC_MISSING: "No microphone found.",
  MIC_BUSY: "Something else is using the microphone.",
  UNSUPPORTED: "This browser can't record voice messages yet.",
  TOO_SHORT: "Keep talking — that was too short.",
  RECORD_FAILED: "Couldn't record that. Try again.",
  UNSUPPORTED_FORMAT: "This voice message format isn't supported yet.",
  TOO_LARGE: "This voice message is too long to send.",
  SEND_FAILED: "Couldn't send · Tap to retry",
  GONE: "That recording is gone. Record a new one.",
  PLAYBACK: "Couldn't play this voice message.",
  UNSUPPORTED_PLAYBACK: "This voice message can't be played in this browser.",
  WAITING: "Waiting for connection",
} as const;

const INTERNAL_DERIVATIVE_MIME = "Preview files must be WebP or JPEG.";
const INTERNAL_PREVIEW_MIME = "Preview files must be WebP or JPEG.";

/** Map server/internal media errors to consumer-facing copy. */
export function mapMediaErrorToConsumer(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return CONSUMER_PHOTO_ERRORS.SEND_FAILED;

  const audioSafe = Object.values(CONSUMER_AUDIO_ERRORS) as string[];
  if (audioSafe.includes(trimmed)) return trimmed;

  if (trimmed.includes("audio format")) return CONSUMER_AUDIO_ERRORS.UNSUPPORTED_FORMAT;
  if (trimmed.includes("voice message is too long")) return CONSUMER_AUDIO_ERRORS.TOO_LARGE;
  if (trimmed.includes("voice message is still uploading")) {
    return CONSUMER_AUDIO_ERRORS.SEND_FAILED;
  }
  if (trimmed.includes("this voice message")) return CONSUMER_AUDIO_ERRORS.PLAYBACK;

  const videoSafe = Object.values(CONSUMER_VIDEO_ERRORS) as string[];
  if (videoSafe.includes(trimmed)) return trimmed;

  if (trimmed.includes("video is too large")) return CONSUMER_VIDEO_ERRORS.TOO_LARGE;
  if (trimmed.includes("video format") || trimmed.includes("video can't be played")) {
    return CONSUMER_VIDEO_ERRORS.UNSUPPORTED_FORMAT;
  }
  if (trimmed.includes("prepare this video")) {
    return CONSUMER_VIDEO_ERRORS.PREPARE_FAILED;
  }
  if (trimmed.includes("different video")) return CONSUMER_VIDEO_ERRORS.DIFFERENT_FILE;
  if (trimmed.includes("Choose the video")) return CONSUMER_VIDEO_ERRORS.CHOOSE_AGAIN;

  if (
    trimmed === INTERNAL_DERIVATIVE_MIME ||
    trimmed === INTERNAL_PREVIEW_MIME ||
    trimmed.includes("Preview files must be")
  ) {
    return CONSUMER_PHOTO_ERRORS.PREPARE_FAILED;
  }
  if (trimmed.includes("too large")) return CONSUMER_PHOTO_ERRORS.TOO_LARGE;
  if (trimmed.includes("supported yet") || trimmed.includes("isn't supported")) {
    return CONSUMER_PHOTO_ERRORS.UNSUPPORTED_FORMAT;
  }
  if (trimmed.includes("looks empty")) return CONSUMER_PHOTO_ERRORS.EMPTY_FILE;
  if (trimmed.includes("file type")) return CONSUMER_PHOTO_ERRORS.REJECTED_TYPE;
  if (
    trimmed.includes("prepare") ||
    trimmed.includes("open that photo") ||
    trimmed.includes("invalid dimensions")
  ) {
    return CONSUMER_PHOTO_ERRORS.PREPARE_FAILED;
  }
  if (
    trimmed.includes("upload") ||
    trimmed.includes("storage returned") ||
    trimmed.includes("interrupted") ||
    trimmed.includes("expired") ||
    trimmed.includes("didn't match")
  ) {
    return CONSUMER_PHOTO_ERRORS.SEND_FAILED;
  }
  if (trimmed.includes("Select the photos") || trimmed.includes("Choose the photo")) {
    return CONSUMER_PHOTO_ERRORS.CHOOSE_AGAIN;
  }

  const safe = Object.values(CONSUMER_PHOTO_ERRORS) as string[];
  if (safe.includes(trimmed)) return trimmed;

  return CONSUMER_PHOTO_ERRORS.SEND_FAILED;
}
