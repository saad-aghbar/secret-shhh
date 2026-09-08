"use client";

import {
  invalidatePhotoDownloadPreferences,
  getPhotoDownloadPreferences,
} from "@/lib/media/download-policy";
import { VOICE_PLAYBACK_RATES, type VoicePlaybackRate } from "@/lib/media/validation";

/**
 * Playback speed is a person's habit, not a per-message setting, so it is stored
 * server-side and applies to every voice message on every device they use.
 */

function asRate(value: string | undefined): VoicePlaybackRate {
  const parsed = Number(value);
  return (VOICE_PLAYBACK_RATES as readonly number[]).includes(parsed)
    ? (parsed as VoicePlaybackRate)
    : 1;
}

export async function loadVoiceRate(): Promise<VoicePlaybackRate> {
  const preferences = await getPhotoDownloadPreferences();
  return asRate(preferences.voicePlaybackRate);
}

export async function saveVoiceRate(rate: VoicePlaybackRate): Promise<void> {
  const previous = await getPhotoDownloadPreferences();
  const voicePlaybackRate = String(rate) as "1" | "1.5" | "2";
  // Optimistic: the pill should not wait on the network to change.
  invalidatePhotoDownloadPreferences({ ...previous, voicePlaybackRate });
  try {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voicePlaybackRate }),
    });
  } catch {
    // Speed is a nicety; a failed save just means it resets next session.
  }
}
