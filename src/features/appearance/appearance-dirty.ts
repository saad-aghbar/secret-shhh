let dirty = false;
const listeners = new Set<(dirty: boolean) => void>();

export function setAppearanceDirty(next: boolean) {
  dirty = next;
  for (const listener of listeners) listener(dirty);
}

export function isAppearanceDirty() {
  return dirty;
}

export function subscribeAppearanceDirty(listener: (dirty: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
