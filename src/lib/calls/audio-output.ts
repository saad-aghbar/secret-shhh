export type AudioSessionType = "auto" | "playback" | "play-and-record";

export type SpeakerMode = "system" | "speaker";

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: AudioSessionType };
};

export function supportsOutputSelection() {
  if (typeof window === "undefined") return false;
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

export function supportsAudioSessionHint() {
  if (typeof navigator === "undefined") return false;
  return "audioSession" in navigator && Boolean((navigator as AudioSessionNavigator).audioSession);
}

export function setAudioSessionType(type: AudioSessionType) {
  if (!supportsAudioSessionHint()) return false;
  try {
    (navigator as AudioSessionNavigator).audioSession!.type = type;
    return true;
  } catch {
    return false;
  }
}

export function pickSpeakerDevice(
  devices: Array<{ deviceId: string; label: string }>,
  current?: string | null,
) {
  const usable = devices.filter((device) => device.deviceId && device.deviceId !== "communications");
  if (usable.length < 2) return null;
  const speaker = usable.find((device) => /speaker|speakerphone/i.test(device.label));
  if (speaker && speaker.deviceId !== current) return speaker.deviceId;
  const fallback = usable.find(
    (device) => device.deviceId !== current && device.deviceId !== "default",
  );
  return fallback?.deviceId ?? null;
}

export function pickSystemDevice(
  devices: Array<{ deviceId: string; label: string }>,
  current?: string | null,
) {
  const preferred = devices.find((device) => device.deviceId === "default");
  if (preferred && preferred.deviceId !== current) return preferred.deviceId;
  const other = devices.find((device) => device.deviceId && device.deviceId !== current);
  return other?.deviceId ?? null;
}

export async function listAudioOutputs() {
  if (!supportsOutputSelection()) return [];
  const { Room } = await import("livekit-client");
  return Room.getLocalDevices("audiooutput", false);
}
