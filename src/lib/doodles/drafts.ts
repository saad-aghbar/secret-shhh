import { documentHasInk, emptyDoodleDocument, type DoodleDocument, type DoodleEditorTool } from "@/lib/doodles/document";
import {
  DEFAULT_ERASER_WIDTH,
  DEFAULT_MARKER_OPACITY,
  DEFAULT_MARKER_WIDTH,
  DEFAULT_PEN_OPACITY,
  DEFAULT_PEN_WIDTH,
  DOODLE_DRAFT_MAX_AGE_MS,
} from "@/lib/doodles/limits";
import { DOODLE_DEFAULT_COLOR, PREFS_STORAGE_KEY, RECENT_COLORS_MAX } from "@/lib/doodles/palette";
import { parseDoodleDocumentLoose } from "@/lib/doodles/validation";
import { draftKey, getChatDb, type DoodleDraftRow } from "@/lib/sync/db";

export type DoodleToolPrefs = {
  color: string;
  penWidth: number;
  penOpacity: number;
  markerWidth: number;
  markerOpacity: number;
  eraserWidth: number;
  recentColors: string[];
};

export function defaultToolPrefs(): DoodleToolPrefs {
  return {
    color: DOODLE_DEFAULT_COLOR,
    penWidth: DEFAULT_PEN_WIDTH,
    penOpacity: DEFAULT_PEN_OPACITY,
    markerWidth: DEFAULT_MARKER_WIDTH,
    markerOpacity: DEFAULT_MARKER_OPACITY,
    eraserWidth: DEFAULT_ERASER_WIDTH,
    recentColors: [],
  };
}

export function loadToolPrefs(): DoodleToolPrefs {
  const defaults = defaultToolPrefs();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DoodleToolPrefs>;
    return {
      ...defaults,
      ...parsed,
      recentColors: Array.isArray(parsed.recentColors)
        ? parsed.recentColors.filter((item): item is string => typeof item === "string").slice(0, RECENT_COLORS_MAX)
        : [],
    };
  } catch {
    return defaults;
  }
}

export function saveToolPrefs(prefs: DoodleToolPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode / quota — drawing still works.
  }
}

export function rememberRecentColor(prefs: DoodleToolPrefs, color: string): DoodleToolPrefs {
  const next = [color, ...prefs.recentColors.filter((item) => item !== color)].slice(0, RECENT_COLORS_MAX);
  return { ...prefs, color, recentColors: next };
}

export async function loadDoodleDraft(
  conversationId: string,
  userId: string,
): Promise<DoodleDraftRow | null> {
  try {
    const row = await getChatDb().doodleDrafts.get(draftKey(conversationId, userId));
    if (!row) return null;
    if (Date.now() - new Date(row.updatedAt).getTime() > DOODLE_DRAFT_MAX_AGE_MS) {
      await clearDoodleDraft(conversationId, userId);
      return null;
    }
    return row;
  } catch {
    return null;
  }
}

export async function saveDoodleDraft(input: Omit<DoodleDraftRow, "id">) {
  try {
    const id = draftKey(input.conversationId, input.userId);
    await getChatDb().doodleDrafts.put({ ...input, id });
  } catch {
    // IndexedDB unavailable — in-memory editor still holds the drawing.
  }
}

export async function clearDoodleDraft(conversationId: string, userId: string) {
  try {
    await getChatDb().doodleDrafts.delete(draftKey(conversationId, userId));
  } catch {
    // ignore
  }
}

export function draftDocumentOrEmpty(row: DoodleDraftRow | null): DoodleDocument {
  if (!row) return emptyDoodleDocument();
  return parseDoodleDocumentLoose(row.document) ?? emptyDoodleDocument();
}

export function draftHasInk(row: DoodleDraftRow | null): boolean {
  return Boolean(row && documentHasInk(row.document));
}

export function draftTool(row: DoodleDraftRow | null): DoodleEditorTool {
  if (row?.tool === "marker" || row?.tool === "eraser") {
    return "pen";
  }
  return "pen";
}
