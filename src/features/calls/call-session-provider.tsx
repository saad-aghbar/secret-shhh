"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCallMedia } from "@/features/calls/use-call-media";
import { startRingtone, stopRingtone } from "@/features/calls/ringtone";
import {
  apiAcceptCall,
  apiCancelCall,
  apiDeclineCall,
  apiEndCall,
  apiGetActiveCall,
  apiGetCall,
  apiMarkCallState,
  apiStartCall,
  apiUpgradeCall,
} from "@/lib/calls/client-api";
import {
  CALL_ACTIVE_POLL_MS,
  CALL_BROADCAST_CHANNEL,
  CALL_RING_TIMEOUT_MS,
  isLiveCallStatus,
  isTerminalCallStatus,
  type CallNetworkStatus,
  type CallType,
  type CallView,
} from "@/lib/calls/config";
import { elapsedSince, formatCallDuration } from "@/lib/calls/duration";
import { claimCallTab, clearCallTab, ownsCallTab } from "@/lib/calls/tab-owner";
import { mapConnectionQuality } from "@/lib/calls/quality";
import type { CaptureErrorStatus } from "@/lib/media/capture-errors";
import { getPhotoDownloadPreferences } from "@/lib/media/download-policy";
import { useConversationBroadcast } from "@/lib/realtime/use-conversation-broadcast";
import { uploadManager } from "@/lib/uploads/manager";

export type CallPreviewState = {
  type: CallType;
  role: "caller" | "callee";
  status: CallView["status"];
  muted?: boolean;
  cameraOn?: boolean;
  network?: CallNetworkStatus;
  minimized?: boolean;
  permission?: CaptureErrorStatus | null;
  autoplayBlocked?: boolean;
  partnerName?: string;
  selfName?: string;
  answeredAt?: string | null;
  ringingAt?: string;
  continueWithoutVideo?: boolean;
  speakerOn?: boolean;
  videoUpgradeNote?: boolean;
  videoUpgradedBy?: string | null;
};

type CallSessionValue = {
  call: CallView | null;
  partnerName: string;
  selfName: string;
  conversationId: string;
  minimized: boolean;
  muted: boolean;
  cameraOn: boolean;
  facing: "user" | "environment";
  network: CallNetworkStatus;
  permission: CaptureErrorStatus | null;
  continueWithoutVideo: boolean;
  autoplayBlocked: boolean;
  error: string | null;
  durationLabel: string | null;
  media: ReturnType<typeof useCallMedia>;
  startCall: (type: CallType) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  cancel: () => Promise<void>;
  end: () => Promise<void>;
  setMinimized: (value: boolean) => void;
  toggleMuted: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  continueAudioOnly: () => void;
  startAudio: () => void;
  upgradeToVideo: () => Promise<void>;
  toggleSpeaker: () => void;
  canSpeaker: boolean;
  speakerOn: boolean;
  showVideoUpgradeNote: boolean;
};

const CallSessionContext = createContext<CallSessionValue | null>(null);

export function useCallSession() {
  const value = useContext(CallSessionContext);
  if (!value) throw new Error("CallSessionProvider required");
  return value;
}

export function useCallSessionOptional() {
  return useContext(CallSessionContext);
}

function previewToCall(preview: CallPreviewState, conversationId: string): CallView {
  const now = new Date().toISOString();
  return {
    id: "preview-call",
    conversationId,
    callerId: preview.role === "caller" ? "self" : "partner",
    calleeId: preview.role === "callee" ? "self" : "partner",
    type: preview.type,
    roomName: "shhh-call-preview",
    status: preview.status,
    createdAt: now,
    ringingAt: preview.ringingAt ?? now,
    answeredAt: preview.answeredAt ?? (preview.status === "connected" ? now : null),
    endedAt: isTerminalCallStatus(preview.status) ? now : null,
    endedBy: null,
    endReason: null,
    durationMs: null,
    videoUpgradedBy: preview.videoUpgradedBy ?? null,
    role: preview.role,
  };
}

export function CallSessionProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<CallView | null>(null);
  const [partnerName, setPartnerName] = useState("your person");
  const [selfName, setSelfName] = useState("You");
  const [conversationId, setConversationId] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [network, setNetwork] = useState<CallNetworkStatus>("good");
  const [permission, setPermission] = useState<CaptureErrorStatus | null>(null);
  const [continueWithoutVideo, setContinueWithoutVideo] = useState(false);
  const [lowData, setLowData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [preview, setPreview] = useState<CallPreviewState | null>(null);
  const [upgradeNoteUntil, setUpgradeNoteUntil] = useState(0);
  const startingRef = useRef(false);
  const hadLiveCall = useRef(false);
  const appliedUpgradeRef = useRef<string | null>(null);

  const applyCall = useCallback((next: CallView | null) => {
    setCall(next);
    if (!next || isTerminalCallStatus(next.status)) {
      if (next) clearCallTab(next.id);
      else clearCallTab();
      appliedUpgradeRef.current = null;
      setMinimized(false);
      setMuted(false);
      setCameraOn(true);
      setFacing("user");
      setNetwork("good");
      setPermission(null);
      setContinueWithoutVideo(false);
      setError(null);
      setUpgradeNoteUntil(0);
      return;
    }
    if (next.type === "audio") {
      setCameraOn(false);
      return;
    }
    const key = `${next.id}:${next.videoUpgradedBy ?? "native"}`;
    if (appliedUpgradeRef.current === key) return;
    appliedUpgradeRef.current = key;
    if (!next.videoUpgradedBy) return;
    const selfId = next.role === "caller" ? next.callerId : next.calleeId;
    const mine = next.videoUpgradedBy === selfId;
    setCameraOn(mine);
    if (!mine) {
      const stamped = Date.now();
      setNow(stamped);
      setUpgradeNoteUntil(stamped + 4_000);
    }
  }, []);

  const refetch = useCallback(async (callId?: string) => {
    try {
      if (callId) {
        const next = await apiGetCall(callId);
        applyCall(isTerminalCallStatus(next.status) ? null : next);
        return;
      }
      const payload = await apiGetActiveCall();
      setPartnerName(payload.partnerName);
      setConversationId(payload.conversationId);
      applyCall(payload.call);
    } catch {
      /* keep the local live call; poll will retry */
    }
  }, [applyCall]);

  /* eslint-disable react-hooks/set-state-in-effect -- restore the live call from HTTP */
  useEffect(() => {
    void refetch();
    void getPhotoDownloadPreferences().then((prefs) => setLowData(prefs.lowDataMode));
  }, [refetch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const live = call && isLiveCallStatus(call.status);
    uploadManager.setCallActive(Boolean(live));
  }, [call]);

  useEffect(() => {
    window.__shhhUploadConcurrency = () => uploadManager.getConcurrency();
    return () => {
      delete window.__shhhUploadConcurrency;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetch();
    }, CALL_ACTIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refetch]);

  useConversationBroadcast({
    conversationId,
    enabled: Boolean(conversationId),
    events: [
      "call:incoming",
      "call:accepted",
      "call:declined",
      "call:cancelled",
      "call:ended",
      "call:updated",
    ],
    onEvent: (_event, payload) => {
      const id = typeof payload.callId === "string" ? payload.callId : undefined;
      void refetch(id);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(CALL_BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ kind?: string; callId?: string }>) => {
      if (event.data?.kind === "ended") {
        applyCall(null);
        return;
      }
      if (event.data?.kind === "refresh") {
        void refetch(event.data.callId);
      }
      if (event.data?.kind === "claimed") {
        if (event.data.callId && ownsCallTab(event.data.callId)) return;
        setMinimized(true);
      }
    };
    return () => channel.close();
  }, [applyCall, refetch]);

  useEffect(() => {
    const publish = (kind: string, callId?: string) => {
      if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
      const channel = new BroadcastChannel(CALL_BROADCAST_CHANNEL);
      channel.postMessage({ kind, callId });
      channel.close();
    };
    const live = Boolean(call && isLiveCallStatus(call.status));
    if (!live) {
      if (hadLiveCall.current && !call) {
        publish("ended");
      }
      hadLiveCall.current = false;
      return;
    }
    hadLiveCall.current = true;
    publish("refresh", call?.id);
  }, [call]);

  useEffect(() => {
    if (!call || !isLiveCallStatus(call.status)) {
      stopRingtone();
      return;
    }
    if (call.status !== "ringing") {
      stopRingtone();
      return;
    }
    void startRingtone(call.role === "caller" ? "ringback" : "ring");
    return () => stopRingtone();
  }, [call]);

  useEffect(() => {
    if (!call || !isLiveCallStatus(call.status)) return;
    void import("@/lib/livekit/client");
  }, [call?.id, call?.status]);

  useEffect(() => {
    if (!call || call.status !== "ringing") return;
    const wait = Math.max(0, CALL_RING_TIMEOUT_MS - elapsedSince(call.ringingAt));
    const timer = window.setTimeout(() => {
      void refetch(call.id);
    }, wait + 250);
    return () => window.clearTimeout(timer);
  }, [call, refetch]);

  useEffect(() => {
    if (!call || (call.status !== "connected" && call.status !== "reconnecting")) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [call]);

  const showVideoUpgradeNote =
    preview?.videoUpgradeNote ?? (upgradeNoteUntil > 0 && now > 0 && now < upgradeNoteUntil);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__shhhCallPreview = (state) => {
      setPreview(state);
      if (state) {
        setPartnerName(state.partnerName ?? "Tala");
        setSelfName(state.selfName ?? "Saad");
        setMinimized(Boolean(state.minimized));
        setMuted(Boolean(state.muted));
        setCameraOn(state.cameraOn ?? true);
        setNetwork(state.network ?? "good");
        setPermission(state.permission ?? null);
        setContinueWithoutVideo(Boolean(state.continueWithoutVideo));
      }
    };
    return () => {
      delete window.__shhhCallPreview;
    };
  }, []);

  const activeCall = preview ? previewToCall(preview, conversationId || "preview") : call;

  const media = useCallMedia({
    call: preview ? null : call,
    muted,
    cameraOn,
    facing,
    lowData,
    continueWithoutVideo,
    onNetwork: (quality) => setNetwork(mapConnectionQuality(quality)),
    onReconnecting: () => {
      setNetwork("reconnecting");
      if (activeCall) void apiMarkCallState(activeCall.id, "reconnecting").catch(() => undefined);
    },
    onRecovered: () => {
      setNetwork("good");
      if (activeCall) void apiMarkCallState(activeCall.id, "connected").catch(() => undefined);
    },
    onFailed: () => {
      if (activeCall && !preview) {
        void apiMarkCallState(activeCall.id, "failed").catch(() => undefined);
      }
      applyCall(null);
      setError("Couldn't connect the call.");
    },
    onHeldElsewhere: () => setMinimized(true),
  });

  const durationLabel =
    activeCall?.answeredAt && (activeCall.status === "connected" || activeCall.status === "reconnecting")
      ? formatCallDuration(elapsedSince(activeCall.answeredAt, now > 0 ? now : undefined))
      : null;

  const run = useCallback(async (fn: () => Promise<CallView>) => {
    try {
      const next = await fn();
      applyCall(isTerminalCallStatus(next.status) ? null : next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't connect the call.");
    }
  }, [applyCall]);

  const value = useMemo<CallSessionValue>(
    () => ({
      call: activeCall,
      partnerName,
      selfName,
      conversationId,
      minimized: preview?.minimized ?? minimized,
      muted: preview?.muted ?? muted,
      cameraOn: preview?.cameraOn ?? cameraOn,
      facing,
      network: preview?.network ?? network,
      permission: preview?.permission ?? media.captureError ?? permission,
      continueWithoutVideo: preview?.continueWithoutVideo ?? continueWithoutVideo,
      autoplayBlocked: preview?.autoplayBlocked ?? media.autoplayBlocked,
      error,
      durationLabel,
      media,
      async startCall(type) {
        if (startingRef.current) return;
        startingRef.current = true;
        try {
          const next = await apiStartCall(type);
          claimCallTab(next.id);
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const channel = new BroadcastChannel(CALL_BROADCAST_CHANNEL);
            channel.postMessage({ kind: "claimed", callId: next.id });
            channel.close();
          }
          applyCall(isTerminalCallStatus(next.status) ? null : next);
          setMinimized(false);
          setError(null);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Couldn't connect the call.");
        } finally {
          startingRef.current = false;
        }
      },
      async accept() {
        if (!activeCall) return;
        claimCallTab(activeCall.id);
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const channel = new BroadcastChannel(CALL_BROADCAST_CHANNEL);
          channel.postMessage({ kind: "claimed", callId: activeCall.id });
          channel.close();
        }
        await run(() => apiAcceptCall(activeCall.id));
        setMinimized(false);
      },
      async decline() {
        if (!activeCall) return;
        await run(() => apiDeclineCall(activeCall.id));
      },
      async cancel() {
        if (!activeCall) return;
        await run(() => apiCancelCall(activeCall.id));
      },
      async end() {
        if (!activeCall) return;
        await run(() => apiEndCall(activeCall.id));
      },
      setMinimized,
      toggleMuted: () => setMuted((value) => !value),
      toggleCamera: () => setCameraOn((value) => !value),
      switchCamera: () => setFacing((value) => (value === "user" ? "environment" : "user")),
      continueAudioOnly: () => {
        setContinueWithoutVideo(true);
        setCameraOn(false);
        setPermission(null);
      },
      startAudio: () => {
        void media.startAudio();
      },
      async upgradeToVideo() {
        if (!activeCall || activeCall.type === "video") return;
        setCameraOn(true);
        setMinimized(false);
        await run(() => apiUpgradeCall(activeCall.id));
      },
      toggleSpeaker: () => {
        void media.toggleSpeaker();
      },
      canSpeaker: preview?.speakerOn != null ? true : media.canSpeaker,
      speakerOn: preview?.speakerOn ?? media.speakerOn,
      showVideoUpgradeNote,
    }),
    [
      activeCall,
      partnerName,
      selfName,
      conversationId,
      minimized,
      muted,
      cameraOn,
      facing,
      network,
      permission,
      continueWithoutVideo,
      preview,
      error,
      durationLabel,
      media,
      showVideoUpgradeNote,
      run,
      applyCall,
    ],
  );

  return <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>;
}

declare global {
  interface Window {
    __shhhCallPreview?: (state: CallPreviewState | null) => void;
    __shhhCallMediaDebug?: import("@/features/calls/use-call-media").CallMediaDebug | null;
    __shhhUploadConcurrency?: () => number;
  }
}
