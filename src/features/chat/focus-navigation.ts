/** Navigate into Chat focused on a historical message (Search / History / Media / future reply). */
export function chatFocusHref(messageId: string, from?: "search" | "history" | "media") {
  const qs = new URLSearchParams({ focus: messageId });
  if (from) {
    qs.set("from", from);
  }
  return `/chat?${qs.toString()}`;
}
