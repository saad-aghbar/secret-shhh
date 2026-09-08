import { isAllowedVideoMime, normalizeMime } from "@/lib/media/validation";

export const CAMERA_RECORDER_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export function pickCameraRecorderMime(
  isTypeSupported: (mime: string) => boolean = defaultIsTypeSupported,
): string | null {
  for (const candidate of CAMERA_RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      /* some engines throw on unknown codecs */
    }
  }
  return null;
}

function defaultIsTypeSupported(mime: string) {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);
}

export function cameraRecordingExtension(mimeType: string): "mp4" | "webm" {
  const normalized = normalizeMime(mimeType);
  if (normalized === "video/mp4" || normalized === "video/quicktime") return "mp4";
  return "webm";
}

export function cameraRecordingFileName(mimeType: string, at = Date.now()): string {
  return `shhh-${at}.${cameraRecordingExtension(mimeType)}`;
}

export function toCameraVideoFile(blob: Blob, mimeType: string, at = Date.now()): File {
  const type = mimeType || blob.type || "video/webm";
  return new File([blob], cameraRecordingFileName(type, at), { type, lastModified: at });
}

export function cameraRecordingPassesAllowlist(mimeType: string): boolean {
  return isAllowedVideoMime(normalizeMime(mimeType));
}

export function isShhhCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    pickCameraRecorderMime() !== null
  );
}

export type ActiveCameraRecording = {
  mimeType: string;
  stop: () => Promise<File | null>;
};

type StartCameraRecordingOptions = {
  isTypeSupported?: (mime: string) => boolean;
  MediaRecorderImpl?: typeof MediaRecorder;
  timesliceMs?: number;
};

/**
 * Record the live camera stream. Stores the actual produced MIME on the File
 * so Phase 6 validation (which strips `;codecs=`) accepts WebM and MP4.
 */
export function startCameraRecording(
  stream: MediaStream,
  options: StartCameraRecordingOptions = {},
): ActiveCameraRecording {
  const preferred = pickCameraRecorderMime(options.isTypeSupported);
  const Recorder = options.MediaRecorderImpl ?? MediaRecorder;
  const recorder = preferred ? new Recorder(stream, { mimeType: preferred }) : new Recorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<File | null>((resolve) => {
    recorder.onerror = () => resolve(null);
    recorder.onstop = () => {
      const produced = recorder.mimeType || preferred || "video/webm";
      const blob = new Blob(chunks, { type: produced });
      if (blob.size < 1) {
        resolve(null);
        return;
      }
      resolve(toCameraVideoFile(blob, produced));
    };
  });

  recorder.start(options.timesliceMs ?? 250);

  return {
    mimeType: recorder.mimeType || preferred || "",
    stop: async () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      return finished;
    },
  };
}
