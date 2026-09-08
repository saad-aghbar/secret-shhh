import { cloneStrokes, type DoodleStroke } from "@/lib/doodles/document";
import { MAX_HISTORY } from "@/lib/doodles/limits";

export type DoodleHistoryEntry =
  | { kind: "add"; stroke: DoodleStroke }
  | { kind: "replace"; before: DoodleStroke[]; after: DoodleStroke[] }
  | { kind: "clear"; before: DoodleStroke[] };

export type DoodleHistoryState = {
  strokes: DoodleStroke[];
  past: DoodleHistoryEntry[];
  future: DoodleHistoryEntry[];
};

export function emptyHistory(strokes: DoodleStroke[] = []): DoodleHistoryState {
  return {
    strokes: cloneStrokes(strokes),
    past: [],
    future: [],
  };
}

function apply(strokes: DoodleStroke[], entry: DoodleHistoryEntry): DoodleStroke[] {
  if (entry.kind === "add") {
    return [...strokes, entry.stroke];
  }
  if (entry.kind === "replace") {
    return cloneStrokes(entry.after);
  }
  return [];
}

function revert(strokes: DoodleStroke[], entry: DoodleHistoryEntry): DoodleStroke[] {
  if (entry.kind === "add") {
    return strokes.filter((stroke) => stroke.id !== entry.stroke.id);
  }
  if (entry.kind === "replace") {
    return cloneStrokes(entry.before);
  }
  return cloneStrokes(entry.before);
}

function pushPast(past: DoodleHistoryEntry[], entry: DoodleHistoryEntry): DoodleHistoryEntry[] {
  const next = [...past, entry];
  if (next.length <= MAX_HISTORY) {
    return next;
  }
  return next.slice(next.length - MAX_HISTORY);
}

export function commitEntry(
  state: DoodleHistoryState,
  entry: DoodleHistoryEntry,
): DoodleHistoryState {
  return {
    strokes: apply(state.strokes, entry),
    past: pushPast(state.past, entry),
    future: [],
  };
}

export function commitStroke(state: DoodleHistoryState, stroke: DoodleStroke): DoodleHistoryState {
  return commitEntry(state, { kind: "add", stroke });
}

export function commitReplace(
  state: DoodleHistoryState,
  after: DoodleStroke[],
): DoodleHistoryState {
  if (state.strokes === after) {
    return state;
  }
  return commitEntry(state, {
    kind: "replace",
    before: cloneStrokes(state.strokes),
    after: cloneStrokes(after),
  });
}

export function commitClear(state: DoodleHistoryState): DoodleHistoryState {
  if (state.strokes.length === 0) {
    return state;
  }
  return commitEntry(state, { kind: "clear", before: cloneStrokes(state.strokes) });
}

export function undo(state: DoodleHistoryState): DoodleHistoryState {
  const entry = state.past[state.past.length - 1];
  if (!entry) {
    return state;
  }
  return {
    strokes: revert(state.strokes, entry),
    past: state.past.slice(0, -1),
    future: [...state.future, entry],
  };
}

export function redo(state: DoodleHistoryState): DoodleHistoryState {
  const entry = state.future[state.future.length - 1];
  if (!entry) {
    return state;
  }
  return {
    strokes: apply(state.strokes, entry),
    past: [...state.past, entry],
    future: state.future.slice(0, -1),
  };
}

export function canUndo(state: DoodleHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: DoodleHistoryState): boolean {
  return state.future.length > 0;
}
