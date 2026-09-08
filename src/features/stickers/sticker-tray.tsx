"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Smile, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useLayoutEffect, useMemo, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

import { SoftBoundary } from "@/components/shhh/soft-boundary";
import { ShhhIconButton, ShhhSheet, ShhhSpinner } from "@/components/shhh";
import { StickerDeleteConfirm } from "@/features/stickers/sticker-delete-confirm";

const StickerCreator = dynamic(
  () => import("@/features/stickers/sticker-creator").then((mod) => mod.StickerCreator),
  { ssr: false },
);
import { StickerImage } from "@/features/stickers/sticker-image";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { StickerRef } from "@/lib/chat/types";
import {
  apiArchiveSticker,
  apiListStickers,
  apiSetStickerFavorite,
} from "@/lib/stickers/client-api";
import { dropStickerFromLibrary, stickerRefFromListItem } from "@/lib/stickers/list-item";
import type { StickerLibraryPayload, StickerListItem, StickerSection } from "@/lib/stickers/types";
import { dropPendingStickerSends } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";

export const STICKERS_QUERY_KEY = ["stickers"] as const;

type StickerTrayProps = {
  open: boolean;
  onClose: () => void;
  onSend: (sticker: StickerRef) => void;
  partnerName: string;
  userId: string;
  /** Anchor for desktop floating popover (the sticker button). */
  anchorRef?: RefObject<HTMLElement | null>;
};

const EMPTY_COPY: Record<StickerSection, (partnerName: string) => string> = {
  recent: () => "No stickers here yet.",
  favorites: () => "No favorites yet.",
  mine: () => "You haven't made any stickers yet.",
  partner: (partnerName) => `${partnerName} hasn't made any stickers yet.`,
};

function emptyLibrary(): StickerLibraryPayload {
  return { recent: [], favorites: [], mine: [], partner: [], partnerName: "Them" };
}

export function StickerTray({
  open,
  onClose,
  onSend,
  partnerName,
  userId,
  anchorRef,
}: StickerTrayProps) {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [section, setSection] = useState<StickerSection>("recent");
  const [creating, setCreating] = useState(false);
  const [optimisticRecent, setOptimisticRecent] = useState<StickerListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<StickerListItem | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const query = useQuery({
    queryKey: STICKERS_QUERY_KEY,
    queryFn: apiListStickers,
    enabled: open,
  });

  const library = query.data ?? emptyLibrary();
  const resolvedPartner = library.partnerName || partnerName;

  const items = useMemo(() => {
    const source = library[section] ?? [];
    if (section !== "recent" || optimisticRecent.length === 0) {
      return source;
    }
    const seen = new Set<string>();
    const merged: StickerListItem[] = [];
    for (const item of [...optimisticRecent, ...source]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged.slice(0, 24);
  }, [library, optimisticRecent, section]);

  useLayoutEffect(() => {
    if (!open || !isDesktop) return;

    function place() {
      const node = anchorRef?.current;
      if (!node) {
        setPanelStyle({ left: 16, bottom: 88, width: 360 });
        return;
      }
      const rect = node.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      const bottom = Math.max(24, window.innerHeight - rect.top + 10);
      setPanelStyle({ left, bottom, width });
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, isDesktop, onClose, open]);

  if (!open && creating) {
    setCreating(false);
  }
  if (!open && pendingDelete) {
    setPendingDelete(null);
  }

  function sendTile(item: StickerListItem) {
    setOptimisticRecent((current) => [item, ...current.filter((row) => row.id !== item.id)]);
    onSend(stickerRefFromListItem(item));
  }

  function dropFromTray(stickerId: string) {
    setOptimisticRecent((current) => current.filter((row) => row.id !== stickerId));
    queryClient.setQueryData<StickerLibraryPayload>(STICKERS_QUERY_KEY, (current) =>
      current ? dropStickerFromLibrary(current, stickerId) : current,
    );
  }

  async function confirmDelete() {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    dropFromTray(item.id);
    try {
      await dropPendingStickerSends(item.id);
      await apiArchiveSticker(item.id);
      await queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
    } catch {
      void query.refetch();
    }
  }

  async function toggleFavorite(item: StickerListItem) {
    const next = await apiSetStickerFavorite(item.id, !item.favorited);
    queryClient.setQueryData<StickerLibraryPayload>(STICKERS_QUERY_KEY, (current) => {
      if (!current) return current;
      const patch = (list: StickerListItem[]) =>
        list.map((row) => (row.id === next.id ? next : row));
      return {
        ...current,
        recent: patch(current.recent),
        favorites: next.favorited
          ? [next, ...current.favorites.filter((row) => row.id !== next.id)]
          : current.favorites.filter((row) => row.id !== next.id),
        mine: patch(current.mine),
        partner: patch(current.partner),
      };
    });
  }

  const pills: Array<{ id: StickerSection; label: string; icon?: boolean }> = [
    { id: "recent", label: "Recent" },
    { id: "favorites", label: "Favorites", icon: true },
    { id: "mine", label: "Mine" },
    { id: "partner", label: resolvedPartner },
  ];

  const creator = (
    <SoftBoundary>
      <StickerCreator
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(sticker) => {
          queryClient.setQueryData<StickerLibraryPayload>(STICKERS_QUERY_KEY, (current) => {
            const base = current ?? emptyLibrary();
            return {
              ...base,
              mine: [sticker, ...base.mine.filter((row) => row.id !== sticker.id)],
              recent: [sticker, ...base.recent.filter((row) => row.id !== sticker.id)].slice(0, 24),
            };
          });
          setSection("mine");
          setCreating(false);
        }}
      />
    </SoftBoundary>
  );

  const libraryBody = (
    <div className="min-h-[18rem]">
      <header className="mb-3 flex items-center justify-between gap-2">
        <p className="text-primary-text text-sm font-semibold">Stickers</p>
        <ShhhIconButton
          type="button"
          label="Make a sticker"
          data-testid="sticker-create"
          className="size-10"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4" strokeWidth={2.3} />
        </ShhhIconButton>
      </header>

      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Sticker collections">
        {pills.map((pill) => {
          const active = section === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              data-testid={`sticker-section-${pill.id}`}
              aria-pressed={active}
              className={cn(
                "shhh-press rounded-pill min-h-10 shrink-0 px-3.5 text-sm font-medium",
                active
                  ? "bg-accent-soft text-accent"
                  : "bg-bg-soft text-secondary-text hover:text-primary-text",
              )}
              onClick={() => setSection(pill.id)}
            >
              {pill.icon ? (
                <span className="inline-flex items-center gap-1.5">
                  <Heart className={cn("size-3.5", active && "fill-current")} strokeWidth={2.1} />
                  {pill.label}
                </span>
              ) : (
                pill.label
              )}
            </button>
          );
        })}
      </nav>

      {query.isLoading ? (
        <div className="grid place-items-center py-16" data-testid="sticker-loading">
          <ShhhSpinner />
        </div>
      ) : query.isError ? (
        <div className="px-2 py-10 text-center" data-testid="sticker-error">
          <p className="text-secondary-text text-sm">Couldn’t load stickers.</p>
          <button
            type="button"
            className="text-accent mt-2 text-sm font-semibold"
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-14 text-center" data-testid="sticker-empty">
          <Smile className="text-muted-text mx-auto mb-3 size-7" strokeWidth={1.8} />
          <p className="text-secondary-text text-sm">{EMPTY_COPY[section](resolvedPartner)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2.5 pb-2" data-testid="sticker-grid">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <button
                type="button"
                data-testid="sticker-tile"
                data-sticker-id={item.id}
                className={cn(
                  "sticker-checkered shhh-press aspect-square w-full overflow-hidden rounded-[1.15rem]",
                  "hover:-translate-y-0.5 active:scale-[0.96] motion-reduce:transform-none",
                  "motion-reduce:hover:translate-y-0",
                )}
                onClick={() => sendTile(item)}
                aria-label={item.name?.trim() ? `Send ${item.name}` : "Send sticker"}
              >
                <StickerImage
                  stickerId={item.id}
                  name={item.name}
                  animated={item.animated}
                  className="size-full"
                  priority
                />
              </button>
              <button
                type="button"
                className={cn(
                  "absolute top-1 right-1 grid size-7 place-items-center rounded-full",
                  item.favorited
                    ? "bg-love-soft text-love"
                    : "text-muted-text bg-[color-mix(in_srgb,var(--shhh-surface)_80%,transparent)]",
                )}
                aria-label={item.favorited ? "Unfavorite" : "Favorite"}
                data-testid="sticker-favorite"
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleFavorite(item);
                }}
              >
                <Heart
                  className={cn("size-3.5", item.favorited && "fill-current")}
                  strokeWidth={2.1}
                />
              </button>
              {item.creatorId === userId ? (
                <button
                  type="button"
                  className="text-muted-text absolute start-1 bottom-1 z-[1] grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-surface)_80%,transparent)]"
                  aria-label={
                    item.name?.trim() ? `Remove ${item.name} from stickers` : "Remove from stickers"
                  }
                  data-testid="sticker-delete"
                  data-sticker-id={item.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDelete(item);
                  }}
                >
                  <Trash2 className="size-3.5" strokeWidth={2.1} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const body = creating ? (
    creator
  ) : pendingDelete ? (
    <StickerDeleteConfirm
      onClose={() => setPendingDelete(null)}
      onConfirm={() => void confirmDelete()}
    />
  ) : (
    libraryBody
  );

  if (isDesktop) {
    if (!open || typeof document === "undefined") return null;
    return createPortal(
      <div className="fixed inset-0 z-[70]" data-testid="sticker-tray-desktop">
        <button
          type="button"
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--shhh-overlay)_45%,transparent)]"
          aria-label="Close stickers"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Stickers"
          data-testid="sticker-tray"
          style={panelStyle}
          className={cn(
            "animate-shhh-settle absolute z-[1] overflow-y-auto rounded-[1.75rem]",
            creating ? "max-h-[min(40rem,82vh)]" : "max-h-[min(32rem,70vh)]",
            "bg-sheet p-4 shadow-[var(--shhh-shadow-float)] motion-reduce:animate-none",
          )}
        >
          {body}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <ShhhSheet
      open={open}
      onClose={onClose}
      className={
        creating ? "h-[min(82dvh,42rem)] max-h-[min(82dvh,42rem)]" : "h-[56vh] max-h-[56vh]"
      }
      data-testid="sticker-tray"
    >
      {body}
    </ShhhSheet>
  );
}
