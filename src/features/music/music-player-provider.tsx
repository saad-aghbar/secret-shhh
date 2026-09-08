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

import { useCallSessionOptional } from "@/features/calls/call-session-provider";
import { usePrivacy } from "@/features/privacy/privacy-provider";
import { isLiveCallStatus } from "@/lib/calls/config";
import { connectionManager } from "@/lib/connection/manager";
import { MUSIC_LISTENED_THRESHOLD_MS } from "@/lib/music/clip";
import { apiRecommendationListened, apiRecordPlayed } from "@/lib/music/client-api";
import {
  clipBounds,
  createQueue,
  currentItem,
  nextIndex,
  previousIndex,
  shuffledCopy,
  type QueueItem,
  type QueueState,
  type RepeatMode,
} from "@/lib/music/player/queue";
import { claimMusicTab, musicTabId, publishMusicClaim, subscribeMusicClaims } from "@/lib/music/player/tab-owner";
import type { YoutubeHost } from "@/lib/music/player/youtube-host";
import { registerMusicPlayerReset } from "@/lib/music/player/session-reset";
import { isYouTubeVideoId } from "@/lib/music/providers/youtube-id";
import { claimPlayback, pauseActivePlayback, releasePlayback } from "@/lib/media/playback-coordinator";

const PLAYER_ID = "shhh-music-player";
const STORAGE_KEY = "shhh.music.queue";

export type PlayerStatus = "idle" | "paused" | "playing" | "unavailable" | "offline";

type MusicPlayerValue = {
  queue: QueueState;
  current: QueueItem | null;
  status: PlayerStatus;
  expanded: boolean;
  progressMs: number;
  durationMs: number;
  error: string | null;
  addOpen: boolean;
  addUrl: string;
  playQueue: (items: QueueItem[], startIndex?: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setExpanded: (open: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  setShuffle: (on: boolean) => void;
  setAudioHold: (hold: boolean) => void;
  openAdd: (url?: string) => void;
  closeAdd: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error("MusicPlayerProvider required");
  return value;
}

export function useMusicPlayerOptional() {
  return useContext(MusicPlayerContext);
}

function readStoredQueue(): QueueState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QueueState;
  } catch {
    return null;
  }
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueState>(() => createQueue([]));
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const hostRef = useRef<YoutubeHost | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const listenedRef = useRef(false);
  const tabIdRef = useRef("");
  const loadedIdRef = useRef<string | null>(null);
  const queueRef = useRef(queue);
  const audioHoldRef = useRef(false);
  const playCurrentRef = useRef<(item: QueueItem, opts?: { resume?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    tabIdRef.current = musicTabId();
  }, []);

  useEffect(() => {
    const shell = document.createElement("div");
    shell.setAttribute("data-testid", "music-youtube-host");
    shell.setAttribute("aria-hidden", "true");
    Object.assign(shell.style, {
      position: "fixed",
      left: "-10000px",
      top: "0px",
      width: "320px",
      height: "180px",
      opacity: "0.01",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "-1",
    });
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "100%";
    shell.appendChild(inner);
    document.body.appendChild(shell);
    mountRef.current = inner;
    return () => {
      hostRef.current?.destroy();
      hostRef.current = null;
      mountRef.current = null;
      shell.remove();
    };
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- restore queue after mount so SSR HTML matches */
  useEffect(() => {
    const stored = readStoredQueue();
    if (stored?.items.length) {
      setQueue(stored);
      setStatus("paused");
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      /* ignore quota */
    }
  }, [hydrated, queue]);

  const pause = useCallback(() => {
    hostRef.current?.pause();
    setStatus((current) => (current === "playing" ? "paused" : current));
    releasePlayback(PLAYER_ID);
  }, []);

  const destroyHost = useCallback(() => {
    hostRef.current?.destroy();
    hostRef.current = null;
    loadedIdRef.current = null;
    mountRef.current?.replaceChildren();
  }, []);

  useEffect(() => {
    registerMusicPlayerReset(() => {
      destroyHost();
      setQueue(createQueue([]));
      setStatus("idle");
      setExpanded(false);
      setProgressMs(0);
      setDurationMs(0);
      setError(null);
    });
    return () => registerMusicPlayerReset(null);
  }, [destroyHost]);

  const waitForMount = useCallback(async () => {
      for (let i = 0; i < 40; i += 1) {
        if (mountRef.current) return mountRef.current;
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    return mountRef.current;
  }, []);

  const playCurrent = useCallback(
    async (item: QueueItem, opts: { resume?: boolean } = {}) => {
      if (audioHoldRef.current) {
        setStatus("paused");
        setError("Music waits until the call ends.");
        return;
      }
      if (connectionManager.getState() === "offline") {
        setStatus("offline");
        setError("You’re offline — playback needs internet.");
        return;
      }
      if (!item.youtubeVideoId || !isYouTubeVideoId(item.youtubeVideoId)) {
        setStatus("unavailable");
        setError("Playback isn’t available for this version.");
        return;
      }
      claimMusicTab();
      publishMusicClaim(tabIdRef.current || musicTabId());
      claimPlayback(PLAYER_ID, () => {
        hostRef.current?.pause();
        setStatus("paused");
      });
      setError(null);
      if (item.durationMs) setDurationMs(item.durationMs);
      const bounds = clipBounds(item);
      const sameVideo = loadedIdRef.current === item.youtubeVideoId && hostRef.current;
      if (opts.resume && sameVideo) {
        if (bounds) hostRef.current?.seekTo(bounds.startMs / 1000);
        hostRef.current?.play();
        setStatus("playing");
        return;
      }
      destroyHost();
      listenedRef.current = false;
      const node = await waitForMount();
      if (!node) return;
      node.replaceChildren();
      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      node.appendChild(target);
      try {
        const { createYoutubeHost } = await import("@/lib/music/player/youtube-host");
        const host = await createYoutubeHost({
          element: target,
          videoId: item.youtubeVideoId,
          origin: window.location.origin,
          startSeconds: bounds ? bounds.startMs / 1000 : 0,
          endSeconds: bounds ? bounds.endMs / 1000 : undefined,
          onPlaying: () => setStatus("playing"),
          onPaused: () => setStatus("paused"),
          onEnded: () => {
            const state = queueRef.current;
            const current = currentItem(state);
            if (clipBounds(current)) {
              setStatus("paused");
              return;
            }
            const index = nextIndex(state);
            if (index == null) {
              setStatus("paused");
              releasePlayback(PLAYER_ID);
              return;
            }
            setQueue((prev) => ({ ...prev, index }));
            const nextItem = state.items[index];
            if (nextItem) void playCurrentRef.current(nextItem);
          },
          onError: () => {
            setStatus("unavailable");
            setError("Playback isn’t available for this version.");
          },
        });
        hostRef.current = host;
        loadedIdRef.current = item.youtubeVideoId;
        host.play();
        setStatus("playing");
        void apiRecordPlayed(item.trackId).catch(() => undefined);
      } catch {
        setStatus("unavailable");
        setError("Playback isn’t available for this version.");
      }
    },
    [destroyHost, waitForMount],
  );

  useEffect(() => {
    playCurrentRef.current = playCurrent;
  }, [playCurrent]);

  const playQueue = useCallback(
    (items: QueueItem[], startIndex = 0) => {
      const next = createQueue(items, startIndex);
      setQueue(next);
      const item = currentItem(next);
      if (item) void playCurrent(item);
    },
    [playCurrent],
  );

  const toggle = useCallback(() => {
    const item = currentItem(queue);
    if (!item) return;
    if (status === "playing") {
      pause();
      return;
    }
    void playCurrent(item, { resume: true });
  }, [pause, playCurrent, queue, status]);

  const next = useCallback(() => {
    const index = nextIndex(queue);
    if (index == null) {
      pause();
      return;
    }
    const item = queue.items[index];
    setQueue((current) => ({ ...current, index }));
    if (item) void playCurrent(item);
  }, [pause, playCurrent, queue]);

  const previous = useCallback(() => {
    const index = previousIndex(queue);
    if (index == null) return;
    const item = queue.items[index];
    setQueue((current) => ({ ...current, index }));
    if (item) void playCurrent(item);
  }, [playCurrent, queue]);

  const seek = useCallback(
    (ms: number) => {
      const item = currentItem(queue);
      const bounds = clipBounds(item);
      const min = bounds?.startMs ?? 0;
      const max = bounds?.endMs ?? (durationMs || Number.POSITIVE_INFINITY);
      const clamped = Math.min(max, Math.max(min, ms));
      hostRef.current?.seekTo(clamped / 1000);
      setProgressMs(clamped);
    },
    [durationMs, queue],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const host = hostRef.current;
      if (!host) return;
      const seconds = host.getCurrentTime();
      const duration = host.getDuration();
      const item = currentItem(queue);
      const bounds = clipBounds(item);
      const ms = seconds * 1000;
      setProgressMs(ms);
      setDurationMs(duration * 1000);
      if (bounds && ms >= bounds.endMs - 80) {
        host.pause();
        setStatus("paused");
      }
      if (item?.recommendationId && status === "playing" && ms >= MUSIC_LISTENED_THRESHOLD_MS && !listenedRef.current) {
        listenedRef.current = true;
        void apiRecommendationListened(item.recommendationId).catch(() => undefined);
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [queue, status]);

  const current = currentItem(queue);
  const bounds = clipBounds(current);
  const value = useMemo<MusicPlayerValue>(
    () => ({
      queue,
      current,
      status,
      expanded,
      progressMs: bounds ? Math.max(0, progressMs - bounds.startMs) : progressMs,
      durationMs: bounds ? bounds.endMs - bounds.startMs : durationMs,
      error,
      addOpen,
      addUrl,
      playQueue,
      toggle,
      pause,
      next,
      previous,
      seek,
      setExpanded,
      setRepeat: (mode) => setQueue((currentQueue) => ({ ...currentQueue, repeat: mode })),
      setShuffle: (on) =>
        setQueue((currentQueue) => {
          if (!on) return { ...currentQueue, shuffle: false };
          const items = shuffledCopy(currentQueue.items, currentQueue.index);
          return { ...currentQueue, items, index: 0, shuffle: true };
        }),
      setAudioHold: (hold) => {
        audioHoldRef.current = hold;
        if (hold) pause();
      },
      openAdd: (url) => {
        setAddUrl(url ?? "");
        setAddOpen(true);
      },
      closeAdd: () => setAddOpen(false),
    }),
    [
      addOpen,
      addUrl,
      bounds,
      current,
      durationMs,
      error,
      expanded,
      next,
      pause,
      playQueue,
      previous,
      progressMs,
      queue,
      seek,
      status,
      toggle,
    ],
  );

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>;
}

export function MusicPlayerBridges() {
  const player = useMusicPlayerOptional();
  const call = useCallSessionOptional();
  const privacy = usePrivacy();

  useEffect(() => {
    if (!player) return;
    if (privacy.locked || privacy.coverVisible) {
      player.pause();
    }
  }, [player, privacy.coverVisible, privacy.locked]);

  useEffect(() => {
    if (!player) return;
    const live = Boolean(call?.call && isLiveCallStatus(call.call.status));
    player.setAudioHold(live);
  }, [call?.call, player]);

  useEffect(() => {
    if (!player) return;
    return connectionManager.subscribe((state) => {
      if (state === "offline") player.pause();
    });
  }, [player]);

  useEffect(() => {
    return subscribeMusicClaims((tabId) => {
      if (tabId !== musicTabId()) {
        player?.pause();
      }
    });
  }, [player]);

  useEffect(() => {
    const onHide = () => pauseActivePlayback();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  return null;
}
