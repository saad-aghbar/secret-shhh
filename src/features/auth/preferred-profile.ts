export const PREFERRED_PROFILE_SLOT_KEY = "shhh.preferredProfileSlot";

export type PreferredSlot = "user_1" | "user_2";

export function readPreferredProfileSlot(): PreferredSlot | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(PREFERRED_PROFILE_SLOT_KEY);
  if (value === "user_1" || value === "user_2") {
    return value;
  }
  return null;
}

export function writePreferredProfileSlot(slot: PreferredSlot) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PREFERRED_PROFILE_SLOT_KEY, slot);
}
