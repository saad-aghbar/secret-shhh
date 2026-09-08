"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CallType, CallView } from "@/lib/calls/config";
import { CALL_RECONNECT_GIVE_UP_MS, isLiveCallStatus } from "@/lib/calls/config";
import { ownsCallTab } from "@/lib/calls/tab-owner";
import { apiCallToken, apiMarkCallState } from "@/lib/calls/client-api";
import {
  listAudioOutputs,
  pickSpeakerDevice,
  pickSystemDevice,
  setAudioSessionType,
  supportsAudioSessionHint,
  supportsOutputSelection,
  type SpeakerMode,
} from "@/lib/calls/audio-output";
import { mapConnectionQuality, nextQualityStep, type QualityStep } from "@/lib/calls/quality";
import { captureErrorStatus, type CaptureErrorStatus } from "@/lib/media/capture-errors";
import { deviceOwner } from "@/lib/media/device-owner";
import type { CallMediaHandles } from "@/lib/livekit/client";
import {
  acquireCallRoom,
  holdCallMediaLock,
  releaseCallMediaLock,
  releaseCallRoom,
} from "@/lib/livekit/session";

export type CallMediaDebug = {
  connected: boolean;
  connectionState: string;
  roomName: string;
  identity: string;
  localAudioPublished: boolean;
  localAudioMuted: boolean;
  localAudioPublications: number;
  localVideoPublished: boolean;
  localVideoMuted: boolean;
  localVideoPublications: number;
  remoteCount: number;
  remoteIdentities: string[];
  remoteAudioSubscribed: number;
  remoteVideoSubscribed: number;
  remoteAudioPublications: number;
  remoteVideoPublications: number;
  captureWidth: number | null;
  captureHeight: number | null;
  captureFrameRate: number | null;
  audioOutputDeviceId: string | null;
  speakerMode: SpeakerMode;
  speakerSupported: boolean;
};

function mediaDebug(
  handles: CallMediaHandles | null,
  extra?: { speakerMode: SpeakerMode; speakerSupported: boolean },
): CallMediaDebug | null {
  const room = handles?.room;
  if (!room) return null;
  const localAudio = [...room.localParticipant.audioTrackPublications.values()];
  const localVideo = [...room.localParticipant.videoTrackPublications.values()];
  const remotes = [...room.remoteParticipants.values()];
  const camera = [...room.localParticipant.videoTrackPublications.values()][0];
  const settings = camera?.track?.mediaStreamTrack?.getSettings();
  return {
    connected: room.state === "connected",
    connectionState: String(room.state),
    roomName: room.name,
    identity: room.localParticipant.identity,
    localAudioPublished: localAudio.some((publication) => publication.track && !publication.isMuted),
    localAudioMuted: localAudio.some((publication) => publication.isMuted),
    localAudioPublications: localAudio.length,
    localVideoPublished: localVideo.some((publication) => publication.track && !publication.isMuted),
    localVideoMuted: localVideo.some((publication) => publication.isMuted),
    localVideoPublications: localVideo.length,
    remoteCount: remotes.length,
    remoteIdentities: remotes.map((participant) => participant.identity),
    remoteAudioPublications: remotes.flatMap((participant) =>
      [...participant.audioTrackPublications.values()],
    ).length,
    remoteVideoPublications: remotes.flatMap((participant) =>
      [...participant.videoTrackPublications.values()],
    ).length,
    remoteAudioSubscribed: remotes.flatMap((participant) =>
      [...participant.audioTrackPublications.values()].filter(
        (publication) => publication.isSubscribed || Boolean(publication.track),
      ),
    ).length,
    remoteVideoSubscribed: remotes.flatMap((participant) =>
      [...participant.videoTrackPublications.values()].filter(
        (publication) =>
          (publication.isSubscribed || Boolean(publication.track)) && !publication.isMuted,
      ),
    ).length,
    captureWidth: settings?.width ?? null,
    captureHeight: settings?.height ?? null,
    captureFrameRate: settings?.frameRate ?? null,
    audioOutputDeviceId: room.getActiveDevice("audiooutput") ?? null,
    speakerMode: extra?.speakerMode ?? "system",
    speakerSupported: extra?.speakerSupported ?? false,
  };
}

function idleDebug(): CallMediaDebug {
  return {
    connected: false,
    connectionState: "idle",
    roomName: "",
    identity: "",
    localAudioPublished: false,
    localAudioMuted: false,
    localAudioPublications: 0,
    localVideoPublished: false,
    localVideoMuted: false,
    localVideoPublications: 0,
    remoteCount: 0,
    remoteIdentities: [],
    remoteAudioSubscribed: 0,
    remoteVideoSubscribed: 0,
    remoteAudioPublications: 0,
    remoteVideoPublications: 0,
    captureWidth: null,
    captureHeight: null,
    captureFrameRate: null,
    audioOutputDeviceId: null,
    speakerMode: "system",
    speakerSupported: false,
  };
}

export type CallMediaController = {
  bindRemoteAudio: (element: HTMLAudioElement | null) => void;
  bindRemoteVideo: (element: HTMLVideoElement | null) => void;
  bindLocalVideo: (element: HTMLVideoElement | null) => void;
  autoplayBlocked: boolean;
  captureError: CaptureErrorStatus | null;
  qualityStep: QualityStep;
  canSpeaker: boolean;
  speakerOn: boolean;
  toggleSpeaker: () => Promise<void>;
  startAudio: () => Promise<void>;
};

export function useCallMedia(params: {
  call: CallView | null;
  muted: boolean;
  cameraOn: boolean;
  facing: "user" | "environment";
  lowData: boolean;
  continueWithoutVideo: boolean;
  onNetwork: (quality: string) => void;
  onReconnecting: () => void;
  onRecovered: () => void;
  onFailed: () => void;
  onHeldElsewhere?: () => void;
}): CallMediaController {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const handlesRef = useRef<CallMediaHandles | null>(null);
  const listenersRef = useRef<Array<() => void>>([]);
  const intentionalRef = useRef(false);
  const reconnectAtRef = useRef(0);
  const lastJoinableIdRef = useRef<string | null>(null);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [captureError, setCaptureError] = useState<CaptureErrorStatus | null>(null);
  const [networkStep, setNetworkStep] = useState<QualityStep | null>(null);
  const [speakerMode, setSpeakerMode] = useState<SpeakerMode>("system");
  const [canSpeaker, setCanSpeaker] = useState(false);
  const qualityStep: QualityStep = networkStep ?? (params.lowData ? "low" : "full");
  const speakerModeRef = useRef<SpeakerMode>("system");
  useEffect(() => {
    speakerModeRef.current = speakerMode;
  }, [speakerMode]);

  const attach = () => {
    const handles = handlesRef.current;
    if (!handles) return;
    if (remoteAudioRef.current) handles.attachRemoteAudio(remoteAudioRef.current);
    if (remoteVideoRef.current) handles.attachRemoteVideo(remoteVideoRef.current);
    if (localVideoRef.current) handles.attachLocalVideo(localVideoRef.current);
  };

  useEffect(() => {
    const call = params.call;
    const joinable =
      call &&
      isLiveCallStatus(call.status) &&
      (call.status === "connecting" ||
        call.status === "connected" ||
        call.status === "reconnecting" ||
        (call.status === "ringing" && call.role === "caller"));
    if (!joinable || !call) {
      return;
    }

    lastJoinableIdRef.current = call.id;
    let cancelled = false;
    intentionalRef.current = false;

    void (async () => {
      if (!ownsCallTab(call.id)) {
        paramsRef.current.onHeldElsewhere?.();
        return;
      }
      const lock = await holdCallMediaLock(call.id);
      if (cancelled) return;
      if (!lock) {
        paramsRef.current.onHeldElsewhere?.();
        return;
      }
      deviceOwner.claim("call");
      try {
        let handles: CallMediaHandles | null = null;
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const minted = await apiCallToken(call.id);
            if (cancelled) return;
            const latest = paramsRef.current;
            const publishCamera =
              call.type === "video" &&
              latest.call?.status !== "ringing" &&
              latest.cameraOn &&
              !latest.continueWithoutVideo;
            const { connectCallRoom } = await import("@/lib/livekit/client");
            handles = await acquireCallRoom(call.id, () =>
              connectCallRoom({
                url: minted.url,
                token: minted.token,
                type: call.type,
                lowData: latest.lowData,
                publishCamera,
                facing: latest.facing,
              }),
            );
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            if (cancelled || attempt === 2) break;
            await new Promise((resolve) => window.setTimeout(resolve, 400));
          }
        }
        if (cancelled) return;
        if (!handles) throw lastError ?? new Error("Couldn't connect the call.");
        handlesRef.current = handles;
        await handles.setMuted(paramsRef.current.muted);
        if (paramsRef.current.call?.type === "video" && paramsRef.current.call.status !== "ringing") {
          await handles.setCameraEnabled(
            paramsRef.current.cameraOn && !paramsRef.current.continueWithoutVideo,
          );
        }
        const heard = await handles.startAudio();
        setAutoplayBlocked(!heard);
        attach();
        if (paramsRef.current.call?.status !== "ringing") {
          await apiMarkCallState(call.id, "connected").catch(() => undefined);
        }

        const room = handles.room;
        const onQuality = (_quality: unknown, participant?: { isLocal?: boolean }) => {
          if (participant?.isLocal) return;
          const quality = String(_quality);
          const current = paramsRef.current;
          current.onNetwork(quality);
          setNetworkStep((step) => {
            const baseline = step ?? (current.lowData ? "low" : "full");
            const next = nextQualityStep(baseline, mapConnectionQuality(quality));
            handles.applyQuality(next);
            return next;
          });
        };
        const onReconnecting = () => {
          if (!reconnectAtRef.current) reconnectAtRef.current = Date.now();
          void apiMarkCallState(call.id, "reconnecting").catch(() => undefined);
          paramsRef.current.onReconnecting();
        };
        const onReconnected = () => {
          reconnectAtRef.current = 0;
          void apiMarkCallState(call.id, "connected").catch(() => undefined);
          paramsRef.current.onRecovered();
        };
        const onDisconnected = () => {
          if (intentionalRef.current || cancelled) return;
          if (!reconnectAtRef.current) reconnectAtRef.current = Date.now();
          if (Date.now() - reconnectAtRef.current >= CALL_RECONNECT_GIVE_UP_MS) {
            paramsRef.current.onFailed();
            return;
          }
          paramsRef.current.onReconnecting();
        };
        const onDeviceError = (error: unknown) => {
          setCaptureError(captureErrorStatus(error));
        };
        const { RoomEvent } = await import("@/lib/livekit/client");
        room.on(RoomEvent.ConnectionQualityChanged, onQuality);
        room.on(RoomEvent.TrackSubscribed, attach);
        room.on(RoomEvent.LocalTrackPublished, attach);
        room.on(RoomEvent.Reconnecting, onReconnecting);
        room.on(RoomEvent.Reconnected, onReconnected);
        room.on(RoomEvent.Disconnected, onDisconnected);
        room.on(RoomEvent.MediaDevicesError, onDeviceError);
        listenersRef.current = [
          () => room.off(RoomEvent.ConnectionQualityChanged, onQuality),
          () => room.off(RoomEvent.TrackSubscribed, attach),
          () => room.off(RoomEvent.LocalTrackPublished, attach),
          () => room.off(RoomEvent.Reconnecting, onReconnecting),
          () => room.off(RoomEvent.Reconnected, onReconnected),
          () => room.off(RoomEvent.Disconnected, onDisconnected),
          () => room.off(RoomEvent.MediaDevicesError, onDeviceError),
        ];
      } catch (error) {
        if (cancelled) return;
        setCaptureError(captureErrorStatus(error));
        if (captureErrorStatus(error) !== "denied" && captureErrorStatus(error) !== "missing") {
          paramsRef.current.onFailed();
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const off of listenersRef.current) off();
      listenersRef.current = [];
    };
    // Connect once per joinable call id; mute/camera are applied separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params callbacks stay in paramsRef
  }, [params.call?.id, params.call?.status, params.call?.role]);

  useEffect(() => {
    const call = params.call;
    const joinable =
      Boolean(call) &&
      isLiveCallStatus(call!.status) &&
      (call!.status === "connecting" ||
        call!.status === "connected" ||
        call!.status === "reconnecting" ||
        (call!.status === "ringing" && call!.role === "caller"));
    if (joinable && call) {
      lastJoinableIdRef.current = call.id;
      return;
    }
    handlesRef.current = null;
    window.__shhhCallMediaDebug = null;
    deviceOwner.release("call");
    const id = lastJoinableIdRef.current;
    if (!id) return;
    const timer = window.setTimeout(() => {
      intentionalRef.current = true;
      releaseCallRoom(id);
      releaseCallMediaLock(id);
      lastJoinableIdRef.current = null;
    }, 2_500);
    return () => window.clearTimeout(timer);
  }, [params.call?.id, params.call?.status, params.call?.role]);

  useEffect(() => {
    let cancelled = false;
    async function resolveSpeaker() {
      if (supportsOutputSelection()) {
        const devices = await listAudioOutputs();
        if (cancelled) return;
        setCanSpeaker(Boolean(pickSpeakerDevice(devices)));
        return;
      }
      setCanSpeaker(supportsAudioSessionHint());
    }
    void resolveSpeaker();
    return () => {
      cancelled = true;
    };
  }, [params.call?.id]);

  useEffect(() => {
    if (params.call && isLiveCallStatus(params.call.status)) return;
    setAudioSessionType("auto");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local speaker mode when the call is gone
    setSpeakerMode("system");
  }, [params.call]);

  useEffect(() => {
    void handlesRef.current?.setMuted(params.muted);
  }, [params.muted]);

  useEffect(() => {
    const call = params.call;
    if (!call || call.type !== "video" || call.status === "ringing") return;
    void handlesRef.current?.setCameraEnabled(params.cameraOn && !params.continueWithoutVideo);
  }, [params.cameraOn, params.continueWithoutVideo, params.call?.type, params.call?.status]);

  useEffect(() => {
    void handlesRef.current?.switchCamera(params.facing);
  }, [params.facing]);

  useEffect(() => {
    const publish = () => {
      const call = paramsRef.current.call;
      window.__shhhCallMediaDebug =
        mediaDebug(handlesRef.current, {
          speakerMode: speakerModeRef.current,
          speakerSupported: canSpeaker,
        }) ?? (call ? { ...idleDebug(), speakerSupported: canSpeaker, speakerMode: speakerModeRef.current } : null);
    };
    publish();
    const timer = window.setInterval(publish, 400);
    return () => {
      window.clearInterval(timer);
      if (!paramsRef.current.call) window.__shhhCallMediaDebug = null;
    };
  }, [params.call?.id, canSpeaker]);

  const bindRemoteAudio = useCallback((element: HTMLAudioElement | null) => {
    remoteAudioRef.current = element;
    attach();
  }, []);
  const bindRemoteVideo = useCallback((element: HTMLVideoElement | null) => {
    remoteVideoRef.current = element;
    attach();
  }, []);
  const bindLocalVideo = useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    attach();
  }, []);

  return {
    bindRemoteAudio,
    bindRemoteVideo,
    bindLocalVideo,
    autoplayBlocked,
    captureError,
    qualityStep,
    canSpeaker,
    speakerOn: speakerMode === "speaker",
    async toggleSpeaker() {
      if (supportsOutputSelection()) {
        const devices = await listAudioOutputs();
        const current = handlesRef.current?.room.getActiveDevice("audiooutput") ?? null;
        const next =
          speakerModeRef.current === "speaker"
            ? pickSystemDevice(devices, current)
            : pickSpeakerDevice(devices, current);
        if (!next) {
          setCanSpeaker(false);
          return;
        }
        const ok = await handlesRef.current?.setAudioOutput(next);
        if (ok) setSpeakerMode(speakerModeRef.current === "speaker" ? "system" : "speaker");
        return;
      }
      if (supportsAudioSessionHint()) {
        const next: SpeakerMode = speakerModeRef.current === "speaker" ? "system" : "speaker";
        const applied = setAudioSessionType(next === "speaker" ? "playback" : "play-and-record");
        if (applied) setSpeakerMode(next);
      }
    },
    async startAudio() {
      const ok = await handlesRef.current?.startAudio();
      setAutoplayBlocked(!ok);
    },
  };
}

export function callNeedsMedia(call: CallView | null, type?: CallType) {
  if (!call) return false;
  if (type && call.type !== type) return false;
  return (
    call.status === "connecting" ||
    call.status === "connected" ||
    call.status === "reconnecting" ||
    (call.status === "ringing" && call.role === "caller")
  );
}
