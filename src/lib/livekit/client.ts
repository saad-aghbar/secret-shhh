import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
  type LocalTrack,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RoomOptions,
} from "livekit-client";

import type { CallType } from "@/lib/calls/config";
import type { QualityStep } from "@/lib/calls/quality";

export type CallMediaHandles = {
  room: Room;
  attachRemoteAudio: (element: HTMLAudioElement) => void;
  attachRemoteVideo: (element: HTMLVideoElement) => void;
  attachLocalVideo: (element: HTMLVideoElement) => void;
  setMuted: (muted: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  switchCamera: (facing: "user" | "environment") => Promise<void>;
  applyQuality: (step: QualityStep) => void;
  startAudio: () => Promise<boolean>;
  setAudioOutput: (deviceId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
};

function roomOptions(lowData: boolean): RoomOptions {
  const capture = lowData ? VideoPresets.h360 : VideoPresets.h720;
  return {
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: false,
    stopLocalTrackOnUnpublish: true,
    videoCaptureDefaults: {
      resolution: capture.resolution,
      facingMode: "user",
    },
    publishDefaults: {
      simulcast: true,
      videoCodec: "vp8",
      videoEncoding: capture.encoding,
      videoSimulcastLayers: lowData
        ? [VideoPresets.h180]
        : [VideoPresets.h180, VideoPresets.h360],
      dtx: true,
      red: true,
      stopMicTrackOnMute: true,
      degradationPreference: "maintain-framerate",
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
}

export function createCallRoom(lowData: boolean) {
  return new Room(roomOptions(lowData));
}

export async function connectCallRoom(params: {
  url: string;
  token: string;
  type: CallType;
  lowData: boolean;
  publishCamera: boolean;
  facing: "user" | "environment";
}): Promise<CallMediaHandles> {
  const room = createCallRoom(params.lowData);
  await room.connect(params.url, params.token, { autoSubscribe: true });
  if (room.state !== "connected") {
    await room.disconnect(true);
    throw new Error("Call room left before media was ready.");
  }
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
    if (params.type === "video" && params.publishCamera) {
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: params.facing,
        resolution: params.lowData ? VideoPresets.h360.resolution : VideoPresets.h720.resolution,
      });
    }
  } catch {
    if (room.state !== "connected") {
      await room.disconnect(true);
      throw new Error("Call room left before media was ready.");
    }
    throw new Error("Couldn't start the microphone.");
  }

  const remoteAudioTracks = () =>
    [...room.remoteParticipants.values()].flatMap((participant) =>
      [...participant.audioTrackPublications.values()]
        .map((publication) => publication.track)
        .filter((track): track is RemoteTrack => Boolean(track)),
    );
  const remoteVideoTracks = () =>
    [...room.remoteParticipants.values()].flatMap((participant) =>
      [...participant.videoTrackPublications.values()]
        .map((publication) => publication.track)
        .filter((track): track is RemoteTrack => Boolean(track)),
    );

  return {
    room,
    attachRemoteAudio(element) {
      for (const track of remoteAudioTracks()) {
        track.attach(element);
      }
    },
    attachRemoteVideo(element) {
      for (const track of remoteVideoTracks()) {
        track.attach(element);
      }
    },
    attachLocalVideo(element) {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track as LocalTrack | undefined;
      track?.attach(element);
    },
    async setMuted(muted) {
      if (room.state !== "connected") return;
      await room.localParticipant.setMicrophoneEnabled(!muted).catch(() => undefined);
    },
    async setCameraEnabled(enabled) {
      if (room.state !== "connected") return;
      await room.localParticipant
        .setCameraEnabled(enabled, {
          facingMode: params.facing,
        })
        .catch(() => undefined);
    },
    async switchCamera(facing) {
      if (room.state !== "connected") return;
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track;
      if (track && "restartTrack" in track && typeof track.restartTrack === "function") {
        await track.restartTrack({ facingMode: facing });
        return;
      }
      await room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      await room.localParticipant.setCameraEnabled(true, { facingMode: facing }).catch(() => undefined);
    },
    applyQuality(step) {
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.videoTrackPublications.values()) {
          const remote = publication as RemoteTrackPublication;
          if (step === "paused") {
            void remote.setEnabled(false);
            continue;
          }
          void remote.setEnabled(true);
          if (step === "low") remote.setVideoQuality(VideoQuality.LOW);
          else if (step === "reduced") remote.setVideoQuality(VideoQuality.MEDIUM);
          else remote.setVideoQuality(VideoQuality.HIGH);
        }
      }
      const local = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (local?.videoTrack && "setPublishingQuality" in local.videoTrack) {
        const quality =
          step === "paused" || step === "low"
            ? VideoQuality.LOW
            : step === "reduced"
              ? VideoQuality.MEDIUM
              : VideoQuality.HIGH;
        local.videoTrack.setPublishingQuality(quality);
      }
    },
    async startAudio() {
      try {
        await room.startAudio();
        return true;
      } catch {
        return false;
      }
    },
    async setAudioOutput(deviceId: string) {
      return room.switchActiveDevice("audiooutput", deviceId);
    },
    async disconnect() {
      await room.disconnect(true);
    },
  };
}

export { ConnectionQuality, RoomEvent, Track, VideoQuality };
