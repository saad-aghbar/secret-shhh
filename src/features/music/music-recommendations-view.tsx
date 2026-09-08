"use client";

import { useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { MusicTrackRow } from "@/features/music/music-track-row";
import { useMusicPlayer } from "@/features/music/music-player-provider";
import { recommendationGiftCopy, recommendationStatusCopy } from "@/lib/music/copy";
import { apiRecommendationOpen, apiRecommendationReact } from "@/lib/music/client-api";
import { toQueueItem } from "@/lib/music/player/queue";
import type { MusicRecommendationDto } from "@/lib/music/types";
import { useConnectionState } from "@/lib/connection/use-connection-state";

export function MusicRecommendationsView({
  incoming,
  sent,
  userId,
  partnerName,
  onOpenTrack,
  onBack,
}: {
  incoming: MusicRecommendationDto[];
  sent: MusicRecommendationDto[];
  userId: string;
  partnerName: string;
  onOpenTrack: (id: string) => void;
  onBack: () => void;
}) {
  const player = useMusicPlayer();
  const [mine, setMine] = useState(false);
  const list = mine ? sent : incoming;
  const offline = useConnectionState() === "offline";

  return (
    <div data-testid="music-recommendations">
      <button type="button" className="text-accent mb-4 text-sm font-semibold" onClick={onBack}>
        Back
      </button>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-full px-4 text-sm font-semibold ${!mine ? "bg-accent-soft text-accent" : "bg-bg-soft"}`}
          onClick={() => setMine(false)}
        >
          For You
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-full px-4 text-sm font-semibold ${mine ? "bg-accent-soft text-accent" : "bg-bg-soft"}`}
          onClick={() => setMine(true)}
        >
          Sent by Me
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-secondary-text text-sm">Nothing waiting here yet.</p>
      ) : (
        list.map((item) => (
          <div key={item.id} className="mb-4">
            <MusicTrackRow
              track={item.track}
              subtitle={`${recommendationGiftCopy(partnerName, item.senderId === userId)} · ${recommendationStatusCopy(item.status, item.senderId === userId)}`}
              onOpen={() => {
                if (!offline && item.recipientId === userId) void apiRecommendationOpen(item.id);
                onOpenTrack(item.track.id);
              }}
              onPlay={() => {
                if (!offline && item.recipientId === userId) void apiRecommendationOpen(item.id);
                player.playQueue([toQueueItem(item.track, { recommendationId: item.id })]);
              }}
            />
            {item.note ? (
              <p className="text-secondary-text px-2 text-sm" dir="auto">
                {item.note}
              </p>
            ) : null}
            {!mine && !offline ? (
              <div className="mt-1 flex flex-wrap gap-2 px-2">
                <ShhhButton
                  size="sm"
                  variant="ghost"
                  data-testid="rec-loved"
                  onClick={() => apiRecommendationReact(item.id, "loved")}
                >
                  Loved ♡
                </ShhhButton>
                <ShhhButton
                  size="sm"
                  variant="ghost"
                  data-testid="rec-liked"
                  onClick={() => apiRecommendationReact(item.id, "liked")}
                >
                  Liked
                </ShhhButton>
                <ShhhButton
                  size="sm"
                  variant="ghost"
                  data-testid="rec-not-for-me"
                  onClick={() => apiRecommendationReact(item.id, "not_for_me")}
                >
                  Not for me
                </ShhhButton>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
