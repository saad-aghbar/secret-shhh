/**
 * Discreet Mode enforcement. Visible notifications stay off.
 * This file may call clearAppBadge. It must never request notification
 * permission, subscribe to push, show a notification, or set a badge.
 */
export function enforceDiscreetMode() {
  if (typeof navigator === "undefined") return;
  const badge = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
  if (typeof badge.clearAppBadge === "function") {
    void badge.clearAppBadge().catch(() => undefined);
  }
}
