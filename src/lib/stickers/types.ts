export type { StickerSection } from "@/lib/stickers/validation";

export type StickerListItem = {
  id: string;
  name: string | null;
  animated: boolean;
  width: number;
  height: number;
  mimeType: string;
  creatorId: string;
  createdAt: string;
  favorited: boolean;
  saved: boolean;
};

export type StickerLibraryPayload = {
  recent: StickerListItem[];
  favorites: StickerListItem[];
  mine: StickerListItem[];
  partner: StickerListItem[];
  partnerName: string;
};

export type StickerReadUrl = {
  url: string;
  expiresAt: string;
  stickerId: string;
};
