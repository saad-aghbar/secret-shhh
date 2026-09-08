"use client";

import type { ApiErrorBody } from "@/types/api";
import type { StickerLibraryPayload, StickerListItem, StickerReadUrl } from "@/lib/stickers/types";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T | Partial<ApiErrorBody>;
  if (!response.ok) {
    throw new Error((body as Partial<ApiErrorBody>).message || "That sticker request failed.");
  }
  return body as T;
}

export async function apiListStickers(): Promise<StickerLibraryPayload> {
  return parse<StickerLibraryPayload>(await fetch("/api/stickers", { cache: "no-store" }));
}

export async function apiCreateSticker(input: {
  id: string;
  file: Blob;
  name?: string | null;
  animated: boolean;
  width: number;
  height: number;
  checksum?: string;
}): Promise<StickerListItem> {
  const form = new FormData();
  form.set("id", input.id);
  form.set("file", input.file, input.animated ? "sticker.gif" : "sticker.webp");
  if (input.name) form.set("name", input.name);
  form.set("animated", input.animated ? "true" : "false");
  form.set("width", String(input.width));
  form.set("height", String(input.height));
  if (input.checksum) form.set("checksum", input.checksum);
  const body = await parse<{ sticker: StickerListItem }>(
    await fetch("/api/stickers", { method: "POST", body: form }),
  );
  return body.sticker;
}

export async function apiGetStickerUrl(stickerId: string): Promise<StickerReadUrl> {
  return parse<StickerReadUrl>(
    await fetch(`/api/stickers/${encodeURIComponent(stickerId)}/url`, { cache: "no-store" }),
  );
}

export async function apiSetStickerFavorite(stickerId: string, favorite: boolean) {
  const body = await parse<{ sticker: StickerListItem }>(
    await fetch(`/api/stickers/${encodeURIComponent(stickerId)}/favorite`, {
      method: favorite ? "PUT" : "DELETE",
    }),
  );
  return body.sticker;
}

export async function apiSetStickerLibrary(stickerId: string, saved: boolean) {
  const body = await parse<{ sticker: StickerListItem }>(
    await fetch(`/api/stickers/${encodeURIComponent(stickerId)}/library`, {
      method: saved ? "PUT" : "DELETE",
    }),
  );
  return body.sticker;
}

export async function apiRenameSticker(stickerId: string, name: string | null) {
  const body = await parse<{ sticker: StickerListItem }>(
    await fetch(`/api/stickers/${encodeURIComponent(stickerId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
  return body.sticker;
}

export async function apiArchiveSticker(stickerId: string) {
  return parse<{ id: string; archived: true }>(
    await fetch(`/api/stickers/${encodeURIComponent(stickerId)}`, { method: "DELETE" }),
  );
}
