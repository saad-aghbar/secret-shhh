"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

import { albumItemCountLabel } from "@/features/media/album-copy";
import { AlbumCoverImage } from "@/features/media/album-cover";
import { AlbumCreateFlow } from "@/features/media/album-create";
import { MediaOverlay } from "@/features/media/media-overlay";
import { mediaKeys } from "@/features/media/query-keys";
import { apiAddAlbumItems, apiListAlbums } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

/**
 * Puts one already-shared photo or video into an existing album. Adding a
 * duplicate is a server-side no-op, so a double tap can't create a second membership.
 */
export function AddToAlbumSheet({
  open,
  onClose,
  mediaId,
  userId,
  userName,
  partnerName,
  partnerId,
}: {
  open: boolean;
  onClose: () => void;
  mediaId: string | null;
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [addedTo, setAddedTo] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: mediaKeys.albums(userId),
    queryFn: apiListAlbums,
    enabled: open,
  });

  const add = useMutation({
    mutationFn: (albumId: string) => apiAddAlbumItems(albumId, mediaId ? [mediaId] : []),
    onSuccess: (result) => {
      setAddedTo((current) => [...new Set([...current, result.album.id])]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
      void queryClient.invalidateQueries({ queryKey: ["media", "album"] });
    },
    onError: () => setError("Couldn't add that."),
  });

  const albums = query.data?.albums ?? [];

  function close() {
    setAddedTo([]);
    setError(null);
    onClose();
  }

  return (
    <>
      <MediaOverlay open={open && !creating} onClose={close} title="Add to album">
        {error ? (
          <p className="mb-3 text-sm text-danger" role="status">
            {error}
          </p>
        ) : null}

        <div className="grid gap-1.5">
          {query.isLoading ? (
            <p className="py-6 text-center text-sm text-secondary-text">Loading albums…</p>
          ) : albums.length === 0 ? (
            <p className="py-4 text-center text-sm text-secondary-text">
              No albums yet — make one for this.
            </p>
          ) : (
            albums.map((album) => {
              const done = addedTo.includes(album.id);
              return (
                <button
                  key={album.id}
                  type="button"
                  data-testid="add-to-album-option"
                  data-album-id={album.id}
                  disabled={done || add.isPending}
                  className={cn(
                    "shhh-press flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] px-3 text-start",
                    "hover:bg-accent-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
                    "disabled:opacity-70",
                  )}
                  onClick={() => add.mutate(album.id)}
                >
                  <AlbumCoverImage
                    cover={album.cover}
                    className="size-11 shrink-0 rounded-[0.9rem]"
                    sizes="3rem"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      dir="auto"
                      className="block truncate text-[15px] font-medium text-primary-text [unicode-bidi:plaintext]"
                    >
                      {album.title}
                    </span>
                    <span className="block text-xs text-secondary-text">
                      {albumItemCountLabel(album.itemCount)}
                    </span>
                  </span>
                  {done ? (
                    <Check className="size-5 shrink-0 text-accent" aria-hidden strokeWidth={2.4} />
                  ) : null}
                  {done ? <span className="sr-only">Added</span> : null}
                </button>
              );
            })
          )}

          <button
            type="button"
            data-testid="add-to-album-new"
            className="shhh-press mt-1 flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] px-3 text-start text-accent hover:bg-accent-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
            onClick={() => setCreating(true)}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[0.9rem] bg-accent-soft">
              <Plus className="size-5" aria-hidden strokeWidth={2.4} />
            </span>
            <span className="text-[15px] font-semibold">New album</span>
          </button>
        </div>
      </MediaOverlay>

      <AlbumCreateFlow
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(albumId) => {
          setCreating(false);
          if (mediaId) add.mutate(albumId);
        }}
        userId={userId}
        userName={userName}
        partnerName={partnerName}
        partnerId={partnerId}
      />
    </>
  );
}
