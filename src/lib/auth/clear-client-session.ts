"use client";

/**
 * Clears identity-specific client state before cookie logout.
 * Call this from every Sign out path so the next identity cannot flash
 * the previous person's drafts, cache, theme, or player.
 */
export async function clearClientSession() {
  const { clearLocalChatData } = await import("@/lib/sync/db");
  const { clearSignedMediaUrlCache } = await import("@/lib/media/signed-url-cache");
  const { clearSignedWallpaperUrlCache } = await import("@/lib/appearance/signed-url-cache");
  const { clearSignedStickerUrlCache } = await import("@/lib/stickers/signed-url-cache");
  const { clearAppearanceClientCache } = await import("@/lib/appearance/client-api");
  const { clearAppearanceDraft } = await import("@/lib/appearance/draft-storage");
  const { clearThemeClientCache } = await import("@/lib/theme/client-api");
  const { clearThemeDraft } = await import("@/lib/theme/draft-storage");
  const { uploadManager } = await import("@/lib/uploads/manager");
  const { clearPrivacyLocalState } = await import("@/lib/privacy/local-lock");
  const { resetMusicPlayerSession } = await import("@/lib/music/player/session-reset");
  const { resetCallRoomSessionForTests } = await import("@/lib/livekit/session");

  clearPrivacyLocalState();
  clearSignedMediaUrlCache();
  clearSignedWallpaperUrlCache();
  clearSignedStickerUrlCache();
  clearAppearanceClientCache();
  clearAppearanceDraft();
  clearThemeClientCache();
  clearThemeDraft();
  resetMusicPlayerSession();
  resetCallRoomSessionForTests();
  await uploadManager.cancelAll();
  await clearLocalChatData();
}
