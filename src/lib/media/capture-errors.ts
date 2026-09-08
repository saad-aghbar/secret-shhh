export type CaptureErrorStatus = "denied" | "missing" | "busy" | "unsupported" | "failed";

export function captureErrorStatus(error: unknown): CaptureErrorStatus {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "denied";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "missing";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "busy";
  }
  if (name === "NotSupportedError") return "unsupported";
  return "failed";
}

export function microphoneErrorCopy(status: CaptureErrorStatus) {
  if (status === "denied") {
    return { title: "Microphone access is off.", body: "Turn it on in your browser settings to talk." };
  }
  if (status === "missing") {
    return { title: "No microphone found.", body: "Connect a microphone, then try again." };
  }
  if (status === "busy") {
    return { title: "Something else is using the microphone.", body: "Close the other app or tab, then try again." };
  }
  if (status === "unsupported") {
    return { title: "This browser can't start the call yet.", body: "Safari on iPhone and Chrome both work." };
  }
  return { title: "Couldn't connect the call.", body: "Try again in a moment." };
}

export function cameraErrorCopy(status: CaptureErrorStatus) {
  if (status === "denied") {
    return { title: "Camera access is off.", body: "Turn it on in your browser settings, or continue without video." };
  }
  if (status === "missing") {
    return { title: "No camera found.", body: "You can keep talking without video." };
  }
  if (status === "busy") {
    return { title: "Something else is using the camera.", body: "Close the other app, or continue without video." };
  }
  return { title: "Couldn't open the camera.", body: "Try again, or continue without video." };
}
