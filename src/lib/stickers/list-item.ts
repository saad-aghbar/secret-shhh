import type { StickerRef } from "@/lib/chat/types";
import type { StickerLibraryPayload, StickerListItem } from "@/lib/stickers/types";

export function stickerRefFromListItem(item: StickerListItem): StickerRef {
  return {
    id: item.id,
    name: item.name,
    animated: item.animated,
    width: item.width,
    height: item.height,
    archived: false,
    creatorId: item.creatorId,
    saved: item.saved,
  };
}

export function dropStickerFromLibrary(
  payload: StickerLibraryPayload,
  stickerId: string,
): StickerLibraryPayload {
  const drop = (list: StickerListItem[]) => list.filter((row) => row.id !== stickerId);
  return {
    ...payload,
    recent: drop(payload.recent),
    favorites: drop(payload.favorites),
    mine: drop(payload.mine),
    partner: drop(payload.partner),
  };
}
