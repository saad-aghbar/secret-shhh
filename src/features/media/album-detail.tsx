"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ShhhButton } from "@/components/shhh";
import { AlbumCoverImage } from "@/features/media/album-cover";
import { albumItemCountLabel, albumMediaNoun } from "@/features/media/album-copy";
import { ALBUM_NOTE_MAX, ALBUM_TITLE_MAX } from "@/features/media/album-constants";
import { AlbumSortableGrid } from "@/features/media/album-sortable-grid";
import { MediaGridSkeleton } from "@/features/media/media-grid";
import { MediaOverlay } from "@/features/media/media-overlay";
import { PhotoPicker } from "@/features/media/photo-picker";
import { mediaKeys } from "@/features/media/query-keys";
import {
  apiAddAlbumItems,
  apiDeleteAlbum,
  apiGetAlbum,
  apiRemoveAlbumItems,
  apiReorderAlbumItems,
  apiUpdateAlbum,
  type AlbumDetailDto,
  type SharedMediaItemDto,
} from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

type Overlay = "none" | "actions" | "add" | "edit" | "cover" | "remove" | "delete";

const menuItem =
  "shhh-press flex min-h-12 w-full items-center gap-3 rounded-[1.15rem] px-4 text-start text-[15px] font-medium text-primary-text hover:bg-accent-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]";

export function AlbumDetail({
  albumId,
  userId,
  userName,
  partnerName,
  partnerId,
  onBack,
  onOpenPhoto,
  onToggleFavorite,
}: {
  albumId: string;
  userId: string;
  userName: string;
  partnerName: string;
  partnerId: string | null;
  onBack: () => void;
  onOpenPhoto: (items: SharedMediaItemDto[], index: number) => void;
  onToggleFavorite: (item: SharedMediaItemDto) => void;
}) {
  const queryClient = useQueryClient();
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [reordering, setReordering] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [addSelection, setAddSelection] = useState<string[]>([]);
  const [removeSelection, setRemoveSelection] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const orderTimer = useRef<number | null>(null);

  const query = useQuery({
    queryKey: mediaKeys.album(userId, albumId),
    queryFn: () => apiGetAlbum(albumId),
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
    staleTime: 3_000,
  });

  const album = query.data?.album ?? null;

  const items = useMemo(() => {
    if (!album) return [];
    if (!pendingOrder) return album.items;
    // Keep the optimistic order visible until the server confirms it.
    const byId = new Map(album.items.map((item) => [item.id, item]));
    const ordered = pendingOrder
      .map((id) => byId.get(id))
      .filter((item): item is SharedMediaItemDto => Boolean(item));
    return ordered.length === album.items.length ? ordered : album.items;
  }, [album, pendingOrder]);

  useEffect(() => {
    return () => {
      if (orderTimer.current) window.clearTimeout(orderTimer.current);
    };
  }, []);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: mediaKeys.album(userId, albumId) });
    void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
  }

  function writeAlbum(next: AlbumDetailDto) {
    queryClient.setQueryData(mediaKeys.album(userId, albumId), { album: next });
    void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
  }

  const update = useMutation({
    mutationFn: (input: { title?: string; note?: string | null; coverMediaId?: string | null }) =>
      apiUpdateAlbum(albumId, input),
    onSuccess: (result) => {
      writeAlbum(result.album);
      setOverlay("none");
      setError(null);
    },
    onError: () => setError("Couldn't update the album."),
  });

  const addItems = useMutation({
    mutationFn: (mediaIds: string[]) => apiAddAlbumItems(albumId, mediaIds),
    onSuccess: (result) => {
      writeAlbum(result.album);
      setAddSelection([]);
      setOverlay("none");
      setError(null);
    },
    onError: () => setError("Couldn't add those."),
  });

  const removeItems = useMutation({
    mutationFn: (mediaIds: string[]) => apiRemoveAlbumItems(albumId, mediaIds),
    onSuccess: (result) => {
      writeAlbum(result.album);
      setRemoveSelection([]);
      setOverlay("none");
      setError(null);
    },
    onError: () => setError("Couldn't remove those."),
  });

  const removeAlbum = useMutation({
    mutationFn: () => apiDeleteAlbum(albumId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
      queryClient.removeQueries({ queryKey: mediaKeys.album(userId, albumId) });
      onBack();
    },
    onError: () => setError("Couldn't delete the album."),
  });

  const reorder = useMutation({
    mutationFn: (mediaIds: string[]) => apiReorderAlbumItems(albumId, mediaIds),
    onSuccess: (result) => {
      setPendingOrder(null);
      writeAlbum(result.album);
    },
    onError: () => {
      // Roll back to the server's order rather than leaving a lie on screen.
      setPendingOrder(null);
      setError("Couldn't save that order.");
      invalidate();
    },
  });

  function queueReorder(mediaIds: string[]) {
    setPendingOrder(mediaIds);
    if (orderTimer.current) window.clearTimeout(orderTimer.current);
    orderTimer.current = window.setTimeout(() => reorder.mutate(mediaIds), 450);
  }

  if (query.isLoading) {
    return (
      <div className="grid gap-5" data-testid="album-detail-loading">
        <div className="animate-shhh-breathe aspect-[16/9] w-full rounded-[1.75rem] bg-[color-mix(in_srgb,var(--shhh-accent-soft)_42%,var(--shhh-bg-soft))] motion-reduce:animate-none" />
        <MediaGridSkeleton count={6} />
      </div>
    );
  }

  if (query.isError || !album) {
    return (
      <div className="py-12 text-center" data-testid="album-detail-error">
        <p className="text-secondary-text text-sm">Couldn&apos;t load this album.</p>
        <div className="mt-4 flex justify-center gap-2">
          <ShhhButton variant="ghost" onClick={onBack}>
            Back to albums
          </ShhhButton>
          <ShhhButton variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </ShhhButton>
        </div>
      </div>
    );
  }

  const subjectFor = (item: SharedMediaItemDto) =>
    `${albumMediaNoun(item.mediaType)} from ${item.senderId === userId ? userName : partnerName}`;
  const labelFor = (item: SharedMediaItemDto) => `Open ${subjectFor(item)}`;

  // Without a photograph there is nothing to wash: the header stays warm and
  // its controls switch to ink so they keep their contrast.
  const hasCover = Boolean(album.cover);
  const headerControl = cn(
    "shhh-press absolute top-3 grid size-11 place-items-center rounded-full backdrop-blur-md",
    "focus-visible:outline-none focus-visible:ring-2",
    hasCover
      ? // Ink chip, not a white veil: these sit on bare photography, which is
        // as likely to be a bright sky as a dark room.
        "bg-[rgb(20_16_13_/0.42)] text-[var(--shhh-viewer-ivory)] hover:bg-[rgb(20_16_13_/0.56)] focus-visible:ring-[var(--shhh-accent-soft)]"
      : "bg-[color-mix(in_srgb,var(--shhh-surface)_70%,transparent)] text-primary-text hover:bg-surface-elevated focus-visible:ring-[var(--shhh-focus-ring)]",
  );

  return (
    <div className="grid gap-5" data-testid="album-detail" data-album-id={album.id}>
      <div className="relative overflow-hidden rounded-[1.75rem] shadow-[var(--shhh-shadow-soft)]">
        <AlbumCoverImage
          cover={album.cover}
          variant="preview"
          className="aspect-[16/10] w-full sm:aspect-[16/7]"
          sizes="(max-width: 1024px) 100vw, 60rem"
        />
        {hasCover ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-[linear-gradient(to_top,rgb(20_16_13_/0.82),rgb(20_16_13_/0.55)_26%,rgb(20_16_13_/0.2)_62%,transparent)]"
          />
        ) : null}

        <button
          type="button"
          aria-label="Back to albums"
          data-testid="album-back"
          className={cn(headerControl, "start-3")}
          onClick={onBack}
        >
          <ArrowLeft className="size-5" strokeWidth={2.2} />
        </button>

        <button
          type="button"
          aria-label="Album options"
          data-testid="album-actions-open"
          className={cn(headerControl, "end-3")}
          onClick={() => setOverlay("actions")}
        >
          <MoreHorizontal className="size-5" strokeWidth={2.2} />
        </button>

        {/* dir="auto" resolves from the title so the count shares its edge. */}
        <div dir="auto" className="absolute inset-x-0 bottom-0 p-5">
          <h1
            data-testid="album-title"
            className={cn(
              "text-2xl leading-tight font-bold [unicode-bidi:plaintext]",
              hasCover ? "text-[var(--shhh-viewer-ivory)]" : "text-primary-text",
            )}
          >
            {album.title}
          </h1>
          <p
            className={cn(
              "mt-1 flex text-sm font-medium",
              hasCover ? "text-[var(--shhh-viewer-ivory)]/80" : "text-secondary-text",
            )}
          >
            <span dir="ltr">{albumItemCountLabel(album.itemCount)}</span>
          </p>
        </div>
      </div>

      {album.note ? (
        <p
          dir="auto"
          data-testid="album-note"
          className="font-message bg-surface-elevated text-primary-text rounded-[1.35rem] px-5 py-4 text-[15px] leading-relaxed shadow-[var(--shhh-shadow-soft)] [unicode-bidi:plaintext]"
        >
          {album.note}
        </p>
      ) : null}

      {error ? (
        <p className="text-danger text-sm" role="status" data-testid="album-error">
          {error}
        </p>
      ) : null}

      {reordering ? (
        <div className="bg-accent-soft/60 flex items-center justify-between gap-3 rounded-[1.35rem] px-4 py-3">
          <p className="text-accent text-sm font-medium">Drag to reorder</p>
          <button
            type="button"
            data-testid="album-reorder-done"
            className="shhh-press rounded-pill bg-accent text-on-accent inline-flex min-h-10 items-center gap-1.5 px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none"
            onClick={() => setReordering(false)}
          >
            <Check className="size-4" aria-hidden strokeWidth={2.5} />
            Done
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center px-6 py-12 text-center"
          data-testid="album-empty"
        >
          <ImageIcon className="text-secondary-text/50 size-8" strokeWidth={1.6} aria-hidden />
          <p className="text-secondary-text mt-3 max-w-xs text-sm leading-relaxed">
            This album is waiting for a few memories.
          </p>
          <ShhhButton
            variant="primary"
            className="mt-5"
            data-testid="album-add-open"
            onClick={() => setOverlay("add")}
          >
            <Plus className="size-4" aria-hidden strokeWidth={2.5} />
            Add photos or videos
          </ShhhButton>
        </div>
      ) : (
        <AlbumSortableGrid
          items={items}
          userId={userId}
          reordering={reordering}
          labelFor={labelFor}
          subjectFor={subjectFor}
          onOpen={(item) =>
            onOpenPhoto(
              items,
              items.findIndex((entry) => entry.id === item.id),
            )
          }
          onToggleFavorite={onToggleFavorite}
          onReorder={queueReorder}
        />
      )}

      {items.length > 0 && !reordering ? (
        <div className="flex justify-center">
          <ShhhButton
            variant="secondary"
            data-testid="album-add-open"
            onClick={() => setOverlay("add")}
          >
            <Plus className="size-4" aria-hidden strokeWidth={2.5} />
            Add photos or videos
          </ShhhButton>
        </div>
      ) : null}

      <MediaOverlay
        open={overlay === "actions"}
        onClose={() => setOverlay("none")}
        title="Album options"
      >
        <div className="grid gap-1">
          <button
            type="button"
            data-testid="album-edit-open"
            className={menuItem}
            onClick={() => {
              setDraftTitle(album.title);
              setDraftNote(album.note ?? "");
              setOverlay("edit");
            }}
          >
            <Pencil className="text-secondary-text size-[18px] shrink-0" aria-hidden />
            Edit name and note
          </button>
          <button
            type="button"
            data-testid="album-cover-open"
            className={menuItem}
            disabled={items.length === 0}
            onClick={() => setOverlay("cover")}
          >
            <ImageIcon className="text-secondary-text size-[18px] shrink-0" aria-hidden />
            Change cover
          </button>
          <button
            type="button"
            data-testid="album-reorder-open"
            className={menuItem}
            disabled={items.length < 2}
            onClick={() => {
              setReordering(true);
              setOverlay("none");
            }}
          >
            <Shuffle className="text-secondary-text size-[18px] shrink-0" aria-hidden />
            Reorder items
          </button>
          <button
            type="button"
            data-testid="album-remove-open"
            className={menuItem}
            disabled={items.length === 0}
            onClick={() => {
              setRemoveSelection([]);
              setOverlay("remove");
            }}
          >
            <Trash2 className="text-secondary-text size-[18px] shrink-0" aria-hidden />
            Remove items
          </button>
          <button
            type="button"
            data-testid="album-delete-open"
            className={cn(menuItem, "text-danger hover:bg-danger/10")}
            onClick={() => setOverlay("delete")}
          >
            <Trash2 className="size-[18px] shrink-0" aria-hidden />
            Delete album
          </button>
        </div>
      </MediaOverlay>

      <MediaOverlay
        open={overlay === "edit"}
        onClose={() => setOverlay("none")}
        title="Edit album"
        footer={
          <ShhhButton
            variant="primary"
            fullWidth
            data-testid="album-edit-save"
            disabled={update.isPending || draftTitle.trim().length === 0}
            onClick={() =>
              update.mutate({ title: draftTitle.trim(), note: draftNote.trim() || null })
            }
          >
            {update.isPending ? "Saving…" : "Save"}
          </ShhhButton>
        }
      >
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-secondary-text text-xs font-medium">Album name</span>
            <input
              data-testid="album-edit-title"
              value={draftTitle}
              dir="auto"
              maxLength={ALBUM_TITLE_MAX}
              className="bg-bg-soft text-primary-text min-h-12 w-full rounded-[1.25rem] px-4 text-[15px] focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none"
              onChange={(event) => setDraftTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-secondary-text text-xs font-medium">Note</span>
            <textarea
              data-testid="album-edit-note"
              value={draftNote}
              dir="auto"
              rows={3}
              maxLength={ALBUM_NOTE_MAX}
              placeholder="Add a little note…"
              className="font-message bg-bg-soft text-primary-text placeholder:text-secondary-text/70 w-full resize-none rounded-[1.25rem] px-4 py-3 text-[15px] leading-relaxed [unicode-bidi:plaintext] focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none"
              onChange={(event) => setDraftNote(event.target.value)}
            />
          </label>
        </div>
      </MediaOverlay>

      <MediaOverlay
        open={overlay === "add"}
        onClose={() => {
          setAddSelection([]);
          setOverlay("none");
        }}
        title="Add photos or videos"
        footer={
          <ShhhButton
            variant="primary"
            fullWidth
            data-testid="album-add-submit"
            disabled={addSelection.length === 0 || addItems.isPending}
            onClick={() => addItems.mutate(addSelection)}
          >
            {addItems.isPending
              ? "Adding…"
              : addSelection.length > 0
                ? `Add ${addSelection.length}`
                : "Add photos or videos"}
          </ShhhButton>
        }
      >
        <PhotoPicker
          userId={userId}
          userName={userName}
          partnerName={partnerName}
          partnerId={partnerId}
          selected={addSelection}
          onSelectedChange={setAddSelection}
          excludeIds={new Set(items.map((item) => item.id))}
        />
      </MediaOverlay>

      <MediaOverlay
        open={overlay === "cover"}
        onClose={() => setOverlay("none")}
        title="Choose a cover"
      >
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-testid="album-cover-choice"
                data-media-id={item.id}
                aria-label="Use this as the album cover"
                aria-pressed={album.cover?.mediaId === item.id}
                className={cn(
                  "bg-bg-soft relative aspect-square w-full overflow-hidden rounded-[1.15rem]",
                  "shhh-press focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none",
                  album.cover?.mediaId === item.id &&
                    "ring-accent ring-offset-background ring-2 ring-offset-2",
                )}
                onClick={() => update.mutate({ coverMediaId: item.id })}
              >
                <AlbumCoverImage
                  cover={{
                    mediaId: item.id,
                    hasPreview: item.hasPreview,
                    hasThumbnail: item.hasThumbnail,
                    width: item.width,
                    height: item.height,
                    mediaType: item.mediaType === "video" ? "video" : "image",
                  }}
                  className="absolute inset-0 size-full"
                  sizes="20vw"
                />
                {album.cover?.mediaId === item.id ? (
                  <span
                    aria-hidden
                    className="bg-accent text-on-accent absolute end-1.5 bottom-1.5 grid size-6 place-items-center rounded-full"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </MediaOverlay>

      <MediaOverlay
        open={overlay === "remove"}
        onClose={() => {
          setRemoveSelection([]);
          setOverlay("none");
        }}
        title="Remove from album"
        footer={
          <div className="grid gap-2">
            <p className="text-secondary-text text-center text-xs">They stay in your chat.</p>
            <ShhhButton
              variant="danger"
              fullWidth
              data-testid="album-remove-submit"
              disabled={removeSelection.length === 0 || removeItems.isPending}
              onClick={() => removeItems.mutate(removeSelection)}
            >
              {removeItems.isPending
                ? "Removing…"
                : removeSelection.length > 0
                  ? `Remove ${removeSelection.length}`
                  : "Remove from album"}
            </ShhhButton>
          </div>
        }
      >
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => {
            const picked = removeSelection.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="album-remove-choice"
                  data-media-id={item.id}
                  aria-pressed={picked}
                  aria-label={
                    picked
                      ? `Keep this ${albumMediaNoun(item.mediaType)}`
                      : `Remove this ${albumMediaNoun(item.mediaType)} from the album`
                  }
                  className={cn(
                    "bg-bg-soft relative aspect-square w-full overflow-hidden rounded-[1.15rem]",
                    "shhh-press focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] focus-visible:outline-none",
                    picked && "ring-danger ring-offset-background ring-2 ring-offset-2",
                  )}
                  onClick={() =>
                    setRemoveSelection((current) =>
                      picked ? current.filter((id) => id !== item.id) : [...current, item.id],
                    )
                  }
                >
                  <AlbumCoverImage
                    cover={{
                      mediaId: item.id,
                      hasPreview: item.hasPreview,
                      hasThumbnail: item.hasThumbnail,
                      width: item.width,
                      height: item.height,
                      mediaType: item.mediaType === "video" ? "video" : "image",
                    }}
                    className="absolute inset-0 size-full"
                    sizes="20vw"
                  />
                  {picked ? (
                    <span
                      aria-hidden
                      className="bg-danger text-on-danger absolute end-1.5 bottom-1.5 grid size-6 place-items-center rounded-full"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </MediaOverlay>

      <MediaOverlay
        open={overlay === "delete"}
        onClose={() => setOverlay("none")}
        title="Delete album?"
        footer={
          <div className="flex gap-2">
            <ShhhButton
              variant="ghost"
              className="flex-1"
              data-testid="album-delete-cancel"
              onClick={() => setOverlay("none")}
            >
              Cancel
            </ShhhButton>
            <ShhhButton
              variant="danger"
              className="flex-1"
              data-testid="album-delete-confirm"
              disabled={removeAlbum.isPending}
              onClick={() => removeAlbum.mutate()}
            >
              {removeAlbum.isPending ? "Deleting…" : "Delete album"}
            </ShhhButton>
          </div>
        }
      >
        <p className="text-secondary-text text-[15px] leading-relaxed">
          They will stay in your chat. Only the album goes away.
        </p>
      </MediaOverlay>
    </div>
  );
}
