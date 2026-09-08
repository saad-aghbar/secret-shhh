"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, ListPlus, Share2 } from "lucide-react";

import { ShhhButton } from "@/components/shhh";
import { musicKeys } from "@/features/music/query-keys";
import { useConnectionState } from "@/lib/connection/use-connection-state";
import {
  apiAddToPlaylist,
  apiCreatePlaylist,
  apiMusicHome,
  apiPatchFavorite,
  apiRecommendTrack,
  apiSendMusicMessage,
} from "@/lib/music/client-api";
import { queueMusicMutation } from "@/lib/music/offline";
import { cn } from "@/lib/utils";

export function MusicTrackActions({
  trackId,
  favorited,
  compact = false,
}: {
  trackId: string;
  favorited?: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const home = useQuery({ queryKey: musicKeys.home(), queryFn: apiMusicHome });
  const offline = useConnectionState() === "offline";
  const playlists = home.data?.home.playlists ?? [];

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: musicKeys.all });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "justify-center")}>
      <ShhhButton
        size={compact ? "sm" : "md"}
        variant="ghost"
        aria-pressed={favorited}
        data-testid="music-love"
        onClick={async () => {
          if (offline) {
            await queueMusicMutation({ kind: "favorite", trackId, favorited: !favorited });
            return;
          }
          await apiPatchFavorite(trackId, !favorited);
          await invalidate();
        }}
      >
        <Heart className={cn("size-4", favorited && "fill-current")} /> Love
      </ShhhButton>
      <ShhhButton
        size={compact ? "sm" : "md"}
        variant="ghost"
        disabled={offline}
        data-testid="music-recommend"
        onClick={() => {
          if (offline) return;
          void apiRecommendTrack(trackId, undefined, crypto.randomUUID()).then(invalidate);
        }}
      >
        Recommend
      </ShhhButton>
      <ShhhButton
        size={compact ? "sm" : "md"}
        variant="ghost"
        data-testid="music-send-chat"
        onClick={async () => {
          await apiSendMusicMessage({ trackId, clientGeneratedId: crypto.randomUUID() });
        }}
      >
        <Share2 className="size-4" /> Send to Chat
      </ShhhButton>
      {playlists[0] && !offline ? (
        <ShhhButton
          size={compact ? "sm" : "md"}
          variant="ghost"
          data-testid="music-add-playlist"
          onClick={() => apiAddToPlaylist(playlists[0]!.id, trackId).then(invalidate)}
        >
          <ListPlus className="size-4" /> Add to {playlists[0].title}
        </ShhhButton>
      ) : !offline ? (
        <ShhhButton
          size={compact ? "sm" : "md"}
          variant="ghost"
          onClick={async () => {
            const created = await apiCreatePlaylist("Ours", true);
            if (created.playlist?.id) await apiAddToPlaylist(created.playlist.id, trackId);
            await invalidate();
          }}
        >
          <ListPlus className="size-4" /> Add to a playlist
        </ShhhButton>
      ) : null}
    </div>
  );
}
