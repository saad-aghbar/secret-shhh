/**
 * HTMLMediaElement.play() rejects with AbortError (unmount) or
 * NotSupportedError (unplayable camera/library clips). Unhandled, those
 * show up as Next.js overlay `unhandledRejection`s.
 */
export function playMediaElement(node: HTMLMediaElement, onUnsupported?: () => void): void {
  void node.play().catch((error: unknown) => {
    const name =
      error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
    if (name === "NotSupportedError") {
      onUnsupported?.();
    }
  });
}
