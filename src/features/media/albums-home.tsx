"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { albumItemCountLabel } from "@/features/media/album-copy";
import { AlbumCoverImage } from "@/features/media/album-cover";
import { AlbumCreateFlow } from "@/features/media/album-create";
import { mediaKeys } from "@/features/media/query-keys";
import { apiListAlbums, type AlbumSummaryDto } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

function AlbumCard({ album, onOpen }: { album: AlbumSummaryDto; onOpen: () => void }) {
  // A coverless album stays warm and cream rather than washing a placeholder
  // with the ink gradient meant to sit over photography.
  const hasCover = Boolean(album.cover);

  return (
    <button
      type="button"
      data-testid="album-card"
      data-album-id={album.id}
      aria-label={`Open album ${album.title}, ${albumItemCountLabel(album.itemCount)}`}
      className={cn(
        "group/album relative block w-full overflow-hidden rounded-[1.6rem] text-start",
        "shadow-[var(--shhh-shadow-soft)]",
        "transition-[transform,box-shadow] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--shhh-shadow-float)] active:scale-[0.985]",
        "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:outline-none",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
      )}
      onClick={onOpen}
    >
      <AlbumCoverImage
        cover={album.cover}
        variant="preview"
        className="aspect-[4/3] w-full"
        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 22rem"
      />

      {/* Soft ink wash keeps the title readable over any photograph. */}
      {hasCover ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(to_top,rgb(20_16_13_/0.8),rgb(20_16_13_/0.5)_28%,rgb(20_16_13_/0.18)_66%,transparent)]"
        />
      ) : null}

      {/*
        dir="auto" on the block resolves from the title (the only child without
        its own dir), so an Arabic album aligns its count and note to the same
        edge as its name.
      */}
      <div dir="auto" className="absolute inset-x-0 bottom-0 p-4">
        <p
          className={cn(
            "line-clamp-2 text-[17px] leading-snug font-semibold [unicode-bidi:plaintext]",
            hasCover ? "text-[var(--shhh-viewer-ivory)]" : "text-primary-text",
          )}
        >
          {album.title}
        </p>
        {/*
          Flex row so the count sits on the card's start edge (which follows the
          title's script) while the inner span keeps "3 items" in reading order.
        */}
        <p
          className={cn(
            "mt-0.5 flex text-xs font-medium",
            hasCover ? "text-[var(--shhh-viewer-ivory)]/75" : "text-secondary-text",
          )}
        >
          <span dir="ltr">{albumItemCountLabel(album.itemCount)}</span>
        </p>
        {album.note ? (
          <p
            dir="auto"
            className={cn(
              "font-message mt-1.5 line-clamp-1 text-[13px] [unicode-bidi:plaintext]",
              hasCover ? "text-[var(--shhh-viewer-ivory)]/85" : "text-secondary-text",
            )}
          >
            {album.note}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function AlbumCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="animate-shhh-breathe aspect-[4/3] w-full rounded-[1.6rem] bg-[color-mix(in_srgb,var(--shhh-accent-soft)_42%,var(--shhh-bg-soft))] motion-reduce:animate-none"
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden
    />
  );
}

export function AlbumsHome({
  userId,
  userName,
  partnerName,
  partnerId,
  onOpenAlbum,
}: {
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
  onOpenAlbum: (albumId: string) => void;
}) {
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: mediaKeys.albums(userId),
    queryFn: apiListAlbums,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
    staleTime: 3_000,
  });

  const albums = query.data?.albums ?? [];

  const newAlbumButton = (
    <button
      type="button"
      data-testid="album-create-open"
      className={cn(
        "shhh-press rounded-pill inline-flex min-h-12 items-center justify-center gap-2 px-5",
        "bg-accent text-on-accent text-sm font-semibold shadow-[var(--shhh-shadow-soft)]",
        "hover:bg-accent-strong hover:-translate-y-px",
        "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
      onClick={() => setCreating(true)}
    >
      <Plus className="size-4" aria-hidden strokeWidth={2.5} />
      New album
    </button>
  );

  return (
    <div className="grid gap-5" data-testid="albums-home">
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <AlbumCardSkeleton key={index} delayMs={index * 90} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="py-10 text-center">
          <p className="text-secondary-text text-sm">Couldn&apos;t load albums.</p>
          <button
            type="button"
            className="shhh-press rounded-pill bg-accent-soft text-accent mt-3 min-h-10 px-4 text-sm font-medium"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : albums.length === 0 ? (
        <div
          className="flex flex-col items-center px-6 py-12 text-center"
          data-testid="albums-empty"
        >
          <h2 className="font-handmade text-primary-text text-2xl tracking-tight">No albums yet</h2>
          <p className="text-secondary-text mt-2 max-w-xs text-sm leading-relaxed">
            Gather a few photos or videos into something you&apos;ll want to look back on.
          </p>
          <div className="mt-6">{newAlbumButton}</div>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album, index) => (
              <li
                key={album.id}
                className="shhh-media-in"
                style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
              >
                <AlbumCard album={album} onOpen={() => onOpenAlbum(album.id)} />
              </li>
            ))}
          </ul>
          <div className="flex justify-center pt-1">{newAlbumButton}</div>
        </>
      )}

      <AlbumCreateFlow
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(albumId) => {
          setCreating(false);
          onOpenAlbum(albumId);
        }}
        userId={userId}
        userName={userName}
        partnerName={partnerName}
        partnerId={partnerId}
      />
    </div>
  );
}
