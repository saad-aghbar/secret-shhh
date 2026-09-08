"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  appendPointIfFarEnough,
  samplePointerPressure,
  simplifyStroke,
} from "@/lib/doodles/geometry";
import {
  countPoints,
  documentHasInk,
  newStrokeId,
  packPoints,
  type DoodleDocument,
  type DoodleEditorTool,
  type DoodlePoint,
  type DoodleStroke,
  type DoodleTool,
} from "@/lib/doodles/document";
import { eraseAlong } from "@/lib/doodles/erase";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  commitClear,
  commitReplace,
  commitStroke,
  emptyHistory,
  redo as historyRedo,
  undo as historyUndo,
  type DoodleHistoryState,
} from "@/lib/doodles/history";
import {
  DEFAULT_ERASER_WIDTH,
  DOODLE_ASPECT_RATIO,
  DOODLE_BACKGROUND_MODE,
  DOODLE_LIMIT_COPY,
  DOODLE_VECTOR_VERSION,
  MAX_STROKES,
  MAX_TOTAL_POINTS,
} from "@/lib/doodles/limits";
import { sanitizeStroke } from "@/lib/doodles/validation";

export type EditorPrefs = {
  color: string;
  penWidth: number;
  penOpacity: number;
  markerWidth: number;
  markerOpacity: number;
  eraserWidth: number;
};

type UseDoodleEditorArgs = {
  initialStrokes?: DoodleStroke[];
  initialPrefs: EditorPrefs;
};

function currentStrokeStyle(tool: DoodleEditorTool, prefs: EditorPrefs) {
  if (tool === "marker") {
    return { width: prefs.markerWidth, opacity: prefs.markerOpacity };
  }
  if (tool === "eraser") {
    return { width: prefs.eraserWidth, opacity: 1 };
  }
  return { width: prefs.penWidth, opacity: prefs.penOpacity };
}

export function useDoodleEditor({ initialStrokes = [], initialPrefs }: UseDoodleEditorArgs) {
  const [history, setHistory] = useState<DoodleHistoryState>(() => emptyHistory(initialStrokes));
  const [tool, setToolState] = useState<DoodleEditorTool>("pen");
  const [prefs, setPrefs] = useState<EditorPrefs>(initialPrefs);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  const liveStrokeRef = useRef<DoodleStroke | null>(null);
  const livePointsRef = useRef<DoodlePoint[]>([]);
  const eraseBeforeRef = useRef<DoodleStroke[] | null>(null);
  const eraseSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const pointerIdRef = useRef<number | null>(null);
  const historyRef = useRef(history);
  const prefsRef = useRef(prefs);
  const toolRef = useRef(tool);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const document = useMemo<DoodleDocument>(
    () => ({
      version: DOODLE_VECTOR_VERSION,
      aspectRatio: DOODLE_ASPECT_RATIO,
      backgroundMode: DOODLE_BACKGROUND_MODE,
      strokes: history.strokes,
    }),
    [history.strokes],
  );

  const hasInk = documentHasInk(document);
  const pointCount = countPoints(document);

  const applyHistory = useCallback((next: DoodleHistoryState) => {
    historyRef.current = next;
    setHistory(next);
    if (countPoints({ strokes: next.strokes }) >= MAX_TOTAL_POINTS * 0.9 || next.strokes.length >= MAX_STROKES) {
      setLimitWarning(DOODLE_LIMIT_COPY);
    } else {
      setLimitWarning(null);
    }
  }, []);

  const setTool = useCallback((next: DoodleEditorTool) => {
    toolRef.current = next;
    setToolState(next);
  }, []);

  const updatePrefs = useCallback((patch: Partial<EditorPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      prefsRef.current = next;
      return next;
    });
  }, []);

  const beginStroke = useCallback((point: DoodlePoint) => {
    const currentTool = toolRef.current;
    const currentPrefs = prefsRef.current;
    const currentHistory = historyRef.current;
    if (currentTool === "eraser") {
      eraseBeforeRef.current = currentHistory.strokes;
      eraseSamplesRef.current = [{ x: point.x, y: point.y }];
      liveStrokeRef.current = null;
      setDrawing(true);
      return;
    }
    if (
      currentHistory.strokes.length >= MAX_STROKES ||
      countPoints({ strokes: currentHistory.strokes }) >= MAX_TOTAL_POINTS
    ) {
      setLimitWarning(DOODLE_LIMIT_COPY);
      return;
    }
    const style = currentStrokeStyle(currentTool, currentPrefs);
    livePointsRef.current = [point];
    liveStrokeRef.current = sanitizeStroke({
      id: newStrokeId(),
      tool: currentTool,
      color: currentPrefs.color,
      width: style.width,
      opacity: style.opacity,
      points: packPoints([point]),
    });
    setDrawing(true);
  }, []);

  const extendStroke = useCallback((point: DoodlePoint) => {
    const currentTool = toolRef.current;
    if (currentTool === "eraser") {
      eraseSamplesRef.current.push({ x: point.x, y: point.y });
      const next = eraseAlong(
        eraseBeforeRef.current ?? historyRef.current.strokes,
        eraseSamplesRef.current,
        prefsRef.current.eraserWidth,
      );
      historyRef.current = { ...historyRef.current, strokes: next };
      setHistory(historyRef.current);
      return;
    }
    const live = liveStrokeRef.current;
    if (!live) return;
    appendPointIfFarEnough(livePointsRef.current, point);
    liveStrokeRef.current = {
      ...live,
      points: packPoints(livePointsRef.current),
    };
  }, []);

  const finishStroke = useCallback(() => {
    const currentTool = toolRef.current;
    setDrawing(false);
    if (currentTool === "eraser") {
      const before = eraseBeforeRef.current;
      const after = historyRef.current.strokes;
      eraseBeforeRef.current = null;
      eraseSamplesRef.current = [];
      if (before && before !== after) {
        applyHistory(
          commitReplace({ ...historyRef.current, strokes: before }, after),
        );
      }
      return;
    }
    const live = liveStrokeRef.current;
    liveStrokeRef.current = null;
    livePointsRef.current = [];
    if (!live || live.points.length < 3) return;
    const simplified = simplifyStroke(live);
    applyHistory(commitStroke(historyRef.current, simplified));
  }, [applyHistory]);

  const undo = useCallback(() => {
    applyHistory(historyUndo(historyRef.current));
  }, [applyHistory]);

  const redo = useCallback(() => {
    applyHistory(historyRedo(historyRef.current));
  }, [applyHistory]);

  const clear = useCallback(() => {
    applyHistory(commitClear(historyRef.current));
  }, [applyHistory]);

  const replaceDocument = useCallback(
    (next: DoodleDocument) => {
      applyHistory(emptyHistory(next.strokes));
    },
    [applyHistory],
  );

  const widthFor = useCallback(
    (which: DoodleEditorTool) => currentStrokeStyle(which, prefs).width,
    [prefs],
  );
  const opacityFor = useCallback(
    (which: DoodleTool) => currentStrokeStyle(which, prefs).opacity,
    [prefs],
  );

  const setWidth = useCallback(
    (value: number) => {
      if (toolRef.current === "marker") updatePrefs({ markerWidth: value });
      else if (toolRef.current === "eraser") updatePrefs({ eraserWidth: value });
      else updatePrefs({ penWidth: value });
    },
    [updatePrefs],
  );

  const setOpacity = useCallback(
    (value: number) => {
      if (toolRef.current === "marker") updatePrefs({ markerOpacity: value });
      else updatePrefs({ penOpacity: value });
    },
    [updatePrefs],
  );

  return {
    document,
    strokes: history.strokes,
    liveStrokeRef,
    tool,
    setTool,
    prefs,
    updatePrefs,
    color: prefs.color,
    setColor: (color: string) => updatePrefs({ color }),
    width: currentStrokeStyle(tool, prefs).width,
    opacity: currentStrokeStyle(tool, prefs).opacity,
    widthFor,
    opacityFor,
    setWidth,
    setOpacity,
    eraserWidth: prefs.eraserWidth ?? DEFAULT_ERASER_WIDTH,
    hasInk,
    drawing,
    pointCount,
    limitWarning,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
    beginStroke,
    extendStroke,
    finishStroke,
    undo,
    redo,
    clear,
    replaceDocument,
    pointerIdRef,
    samplePointerPressure,
  };
}

export function pointerPoint(
  event: Pick<PointerEvent, "clientX" | "clientY" | "pointerType" | "pressure">,
  rect: DOMRect,
): DoodlePoint {
  const x = (event.clientX - rect.left) / Math.max(1, rect.width);
  const y = (event.clientY - rect.top) / Math.max(1, rect.height);
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    pressure: samplePointerPressure(event),
  };
}

export type DoodleEditorApi = ReturnType<typeof useDoodleEditor>;
