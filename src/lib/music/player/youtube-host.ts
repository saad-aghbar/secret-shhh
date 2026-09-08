import { youtubeEmbedUrl } from "@/lib/music/providers/youtube-id";

export type YoutubeHost = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (opts: { videoId: string; startSeconds?: number; endSeconds?: number }) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<void> | null = null;

export function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    window.onYouTubeIframeAPIReady = () => resolve();
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("youtube_api"));
      document.head.appendChild(script);
    }
    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });
  return loading;
}

export async function createYoutubeHost(input: {
  element: HTMLElement;
  videoId: string;
  origin: string;
  startSeconds?: number;
  endSeconds?: number;
  onReady?: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}): Promise<YoutubeHost> {
  await loadYouTubeApi();
  if (!window.YT?.Player) {
    throw new Error("youtube_api");
  }
  const startSeconds = Math.max(0, Math.floor(input.startSeconds ?? 0));
  const endSeconds =
    typeof input.endSeconds === "number" && input.endSeconds > startSeconds
      ? Math.floor(input.endSeconds)
      : undefined;
  const player = await new Promise<YTPlayer>((resolve, reject) => {
    try {
      const instance = new window.YT!.Player(input.element, {
        videoId: input.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: input.origin,
          enablejsapi: 1,
          start: startSeconds,
        },
        events: {
          onReady: () => {
            const iframe =
              input.element instanceof HTMLIFrameElement
                ? input.element
                : input.element.querySelector("iframe");
            if (iframe instanceof HTMLIFrameElement) {
              iframe.setAttribute("aria-hidden", "true");
              iframe.tabIndex = -1;
              iframe.style.position = "absolute";
              iframe.style.inset = "0";
            }
            if (endSeconds != null) {
              instance.loadVideoById({
                videoId: input.videoId,
                startSeconds,
                endSeconds,
              });
            }
            input.onReady?.();
            resolve(instance);
          },
          onStateChange: (event) => {
            const state = window.YT?.PlayerState;
            if (!state) return;
            if (event.data === state.PLAYING) input.onPlaying?.();
            if (event.data === state.PAUSED) input.onPaused?.();
            if (event.data === state.ENDED) input.onEnded?.();
          },
          onError: () => input.onError?.(),
        },
      });
    } catch (error) {
      reject(error);
    }
  });
  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seekTo: (seconds) => player.seekTo(seconds, true),
    getCurrentTime: () => player.getCurrentTime?.() ?? 0,
    getDuration: () => player.getDuration?.() ?? 0,
    destroy: () => player.destroy(),
  };
}

export function embedSrc(videoId: string, origin: string) {
  return youtubeEmbedUrl(videoId, origin);
}
