"use client";

import { Heart, ListMusic, Pause, Play, Repeat, Share2, Shuffle, SkipBack, SkipForward, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ShhhButton, ShhhIconButton, ShhhSlider } from "@/components/shhh";
import { useCallSessionOptional } from "@/features/calls/call-session-provider";
import { AddMusicSheet } from "@/features/music/add-music-sheet";
import { MusicArtwork } from "@/features/music/music-artwork";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { usePrivacy } from "@/features/privacy/privacy-provider";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { isLiveCallStatus } from "@/lib/calls/config";
import { formatClock } from "@/lib/music/clip";
import { displayArtistName } from "@/lib/music/copy";
import { apiPatchFavorite, apiRecommendTrack, apiSendMusicMessage } from "@/lib/music/client-api";
import { cn } from "@/lib/utils";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MusicPlayerHost() {
  const player = useMusicPlayer();
  const call = useCallSessionOptional();
  const privacy = usePrivacy();
  const pathname = usePathname();
  const keyboardInset = useKeyboardInset();
  const current = player.current;
  const live = Boolean(call?.call && isLiveCallStatus(call.call.status));
  const callPill = Boolean(live && call?.minimized);
  const onChat = pathname.startsWith("/chat");
  const hidden = privacy.locked || privacy.coverVisible || Boolean(live && !call?.minimized);
  const miniSize = onChat ? "3.25rem" : "4.75rem";

  useEffect(() => {
    const root = document.documentElement;
    if (current && !player.expanded && !hidden) {
      root.style.setProperty("--shhh-mini-player", miniSize);
    } else {
      root.style.removeProperty("--shhh-mini-player");
    }
    return () => {
      root.style.removeProperty("--shhh-mini-player");
    };
  }, [current, hidden, miniSize, player.expanded]);

  if (hidden) {
    return null;
  }

  if (!current && !player.addOpen) {
    return <AddMusicSheet />;
  }

  const chatBottom =
    keyboardInset > 80
      ? `calc(${keyboardInset}px + 5.15rem)`
      : "calc(9.35rem + var(--shhh-safe-bottom))";
  const bottom = callPill
    ? "calc(8.5rem + var(--shhh-safe-bottom) + 3.35rem)"
    : onChat
      ? chatBottom
      : "calc(5.5rem + var(--shhh-safe-bottom) + 0.5rem)";

  return (
    <>
      {current && !player.expanded ? (
        <div
          data-testid="music-mini-player"
          className="fixed inset-x-0 z-[45] mx-auto w-[min(100%-1.5rem,28rem)]"
          style={{ bottom }}
        >
          <div
            className={cn(
              "flex w-full items-center gap-2.5 rounded-full px-2 py-1 pe-2",
              onChat ? "min-h-10" : "min-h-12 py-1.5 pe-3 rounded-[1.6rem]",
              "bg-surface-elevated/95 shadow-[var(--shhh-shadow-float)] backdrop-blur-md",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 text-start",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
                !prefersReducedMotion() && "shhh-press",
              )}
              onClick={() => player.setExpanded(true)}
              aria-label="Open player"
            >
              <MusicArtwork
                src={current.artworkUrl}
                alt=""
                size="sm"
                className={cn("rounded-full", onChat ? "size-8" : "size-11 rounded-[1rem]")}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-primary-text">{current.title}</span>
                {onChat ? null : (
                  <span className="text-secondary-text block truncate text-xs">
                    {displayArtistName(current.artistName)}
                  </span>
                )}
              </span>
            </button>
            {onChat ? null : (
              <ShhhIconButton label="Next" data-testid="music-mini-next" onClick={() => player.next()}>
                <SkipForward className="size-4 fill-current" />
              </ShhhIconButton>
            )}
            <ShhhIconButton
              label={player.status === "playing" ? "Pause" : "Play"}
              data-testid="music-mini-toggle"
              disabled={player.status === "offline"}
              className={onChat ? "size-10" : "size-11"}
              onClick={() => player.toggle()}
            >
              {player.status === "playing" ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </ShhhIconButton>
          </div>
        </div>
      ) : null}
      {player.expanded && current ? <ExpandedPlayer /> : null}
      <AddMusicSheet />
    </>
  );
}

function ExpandedPlayer() {
  const player = useMusicPlayer();
  const current = player.current!;
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previousFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        player.setExpanded(false);
        return;
      }
      if (event.key === "ArrowRight") {
        player.seek(player.progressMs + 5_000);
      }
      if (event.key === "ArrowLeft") {
        player.seek(Math.max(0, player.progressMs - 5_000));
      }
      if (event.key === " ") {
        event.preventDefault();
        player.toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  const unavailable = player.status === "unavailable" || player.status === "offline";
  const wash = current.artworkUrl
    ? `linear-gradient(color-mix(in srgb, var(--shhh-bg) 92%, transparent), color-mix(in srgb, var(--shhh-bg) 97%, transparent)), url(${current.artworkUrl})`
    : "color-mix(in srgb, var(--shhh-bg) 92%, var(--shhh-accent-soft))";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      data-testid="music-expanded-player"
      style={{
        background: wash,
        backgroundSize: "cover",
        backgroundPosition: "center",
        paddingTop: "var(--shhh-safe-top)",
        paddingBottom: "calc(var(--shhh-safe-bottom) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5">
        <div className="flex items-center justify-between py-3">
          <ShhhIconButton ref={closeRef} label="Close player" onClick={() => player.setExpanded(false)}>
            <X className="size-5" />
          </ShhhIconButton>
          <p className="text-secondary-text text-xs font-semibold tracking-wide uppercase">Now playing</p>
          <span className="size-11" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <MusicArtwork
            src={current.artworkUrl} alt=""
            size="hero"
            className="aspect-square w-full max-w-[16.5rem] rounded-[2rem] shadow-[var(--shhh-shadow-float)]"
          />
          <div className="w-full text-center">
            <p className="text-xl font-semibold text-primary-text" data-testid="music-now-title">
              {current.title}
            </p>
            <p className="text-secondary-text mt-1 text-sm">{displayArtistName(current.artistName)}</p>
            <p className="sr-only" aria-live="polite">
              {current.title}
              {displayArtistName(current.artistName) ? ` by ${displayArtistName(current.artistName)}` : ""}
            </p>
          </div>
          {unavailable ? (
            <div className="bg-surface-elevated rounded-[1.4rem] px-5 py-4 text-center shadow-[var(--shhh-shadow-soft)]">
              <p className="text-sm text-primary-text">
                {player.status === "offline"
                  ? "You’re offline — playback needs internet."
                  : "Playback isn’t available for this version."}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <ShhhButton
                  variant="secondary"
                  onClick={() => {
                    player.setExpanded(false);
                    player.openAdd();
                  }}
                >
                  Choose another version
                </ShhhButton>
                {current.youtubeVideoId ? (
                  <a
                    className="text-accent text-sm font-semibold"
                    href={`https://www.youtube.com/watch?v=${current.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original source
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="w-full">
            <ShhhSlider
              label="Seek"
              min={0}
              max={Math.max(1, player.durationMs || current.durationMs || 1)}
              value={Math.min(player.progressMs, player.durationMs || current.durationMs || 1)}
              onChange={(event) => player.seek(Number(event.target.value))}
              data-testid="music-seek"
              disabled={player.status === "offline"}
            />
            <div className="text-muted-text mt-1 flex justify-between text-xs tabular-nums">
              <span>{formatClock(player.progressMs)}</span>
              <span>{formatClock(player.durationMs || current.durationMs || 0)}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-5">
            <ShhhIconButton label="Previous" className="size-12" onClick={player.previous}>
              <SkipBack className="size-5 fill-current" />
            </ShhhIconButton>
            <ShhhIconButton
              label={player.status === "playing" ? "Pause" : "Play"}
              className="size-16"
              onClick={player.toggle}
              data-testid="music-expanded-toggle"
              disabled={player.status === "offline"}
            >
              {player.status === "playing" ? (
                <Pause className="size-7 fill-current" />
              ) : (
                <Play className="size-7 fill-current" />
              )}
            </ShhhIconButton>
            <ShhhIconButton label="Next" className="size-12" onClick={player.next}>
              <SkipForward className="size-5 fill-current" />
            </ShhhIconButton>
          </div>
          <div className="flex items-center justify-center gap-1">
            <ShhhIconButton
              label="Love"
              data-testid="music-love"
              onClick={() => void apiPatchFavorite(current.trackId, true)}
            >
              <Heart className="size-5" />
            </ShhhIconButton>
            <ShhhIconButton
              label="Send to Chat"
              data-testid="music-send-chat"
              onClick={() =>
                void apiSendMusicMessage({ trackId: current.trackId, clientGeneratedId: crypto.randomUUID() })
              }
            >
              <Share2 className="size-5" />
            </ShhhIconButton>
            <ShhhIconButton
              label="Recommend"
              data-testid="music-recommend"
              onClick={() => void apiRecommendTrack(current.trackId, undefined, crypto.randomUUID())}
            >
              <Sparkles className="size-5" />
            </ShhhIconButton>
            <ShhhIconButton
              label={player.queue.shuffle ? "Shuffle on" : "Up next"}
              aria-pressed={player.queue.shuffle}
              onClick={() => player.setShuffle(!player.queue.shuffle)}
            >
              {player.queue.items.length > 1 ? (
                <ListMusic className="size-5" />
              ) : (
                <Shuffle className={cn("size-5", player.queue.shuffle && "text-accent")} />
              )}
            </ShhhIconButton>
            <ShhhIconButton
              label={`Repeat ${player.queue.repeat}`}
              onClick={() =>
                player.setRepeat(
                  player.queue.repeat === "none" ? "all" : player.queue.repeat === "all" ? "one" : "none",
                )
              }
            >
              <Repeat className={cn("size-5", player.queue.repeat !== "none" && "text-accent")} />
            </ShhhIconButton>
          </div>
        </div>
        {player.queue.items.length > 1 ? (
          <div className="pb-4">
            <p className="text-secondary-text mb-2 text-xs font-semibold">Up Next</p>
            <ul className="space-y-1">
              {player.queue.items
                .map((item, index) => ({ item, index }))
                .filter(({ index }) => index !== player.queue.index)
                .slice(0, 4)
                .map(({ item, index }) => (
                  <li key={`${item.trackId}-${index}`} className="truncate text-sm text-primary-text">
                    {item.title}
                    {displayArtistName(item.artistName) ? (
                      <span className="text-secondary-text"> · {displayArtistName(item.artistName)}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <div className="text-muted-text flex items-center justify-center gap-2 pb-6 text-xs">
            <Heart className="size-3.5" /> Quiet soundtrack
          </div>
        )}
      </div>
    </div>
  );
}
