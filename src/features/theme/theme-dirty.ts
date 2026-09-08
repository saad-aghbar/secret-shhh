let dirty = false;
const listeners = new Set<(dirty: boolean) => void>();

export function setThemeDirty(next: boolean) {
  dirty = next;
  for (const listener of listeners) listener(dirty);
}

export function isThemeDirty() {
  return dirty;
}

export function subscribeThemeDirty(listener: (dirty: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let discardDraft: (() => void) | null = null;

export function registerThemeDiscard(handler: () => void) {
  discardDraft = handler;
  return () => {
    if (discardDraft === handler) discardDraft = null;
  };
}

export function discardThemeDraft() {
  discardDraft?.();
  setThemeDirty(false);
}
