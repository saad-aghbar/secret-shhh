"use client";

import { Redo2, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { lockPageScroll } from "@/components/shhh/scroll-lock";
import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { DoodleCanvas } from "@/features/doodles/doodle-canvas";
import { DoodleColorPalette } from "@/features/doodles/doodle-color-palette";
import { DoodleStrokeOptions } from "@/features/doodles/doodle-stroke-options";
import { DoodleToolDock } from "@/features/doodles/doodle-tool-dock";
import { useDoodleEditor } from "@/features/doodles/use-doodle-editor";
import { documentHasInk, emptyDoodleDocument, type DoodleDocument, type DoodleEditorTool } from "@/lib/doodles/document";
import {
  clearDoodleDraft,
  draftHasInk,
  loadDoodleDraft,
  loadToolPrefs,
  rememberRecentColor,
  saveDoodleDraft,
  saveToolPrefs,
  type DoodleToolPrefs,
} from "@/lib/doodles/drafts";
import { parseDoodleDocument } from "@/lib/doodles/validation";
import { cn } from "@/lib/utils";

type DoodleEditorProps = {
  open: boolean;
  partnerName: string;
  conversationId: string;
  userId: string;
  onClose: () => void;
  onSend: (document: DoodleDocument) => void;
};

export function DoodleEditor({
  open,
  partnerName,
  conversationId,
  userId,
  onClose,
  onSend,
}: DoodleEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [prefs] = useState<DoodleToolPrefs>(() => loadToolPrefs());
  const [restore, setRestore] = useState<DoodleDocument | null>(null);
  const [askRestore, setAskRestore] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const editor = useDoodleEditor({
    initialStrokes: [],
    initialPrefs: {
      color: prefs.color,
      penWidth: prefs.penWidth,
      penOpacity: prefs.penOpacity,
      markerWidth: prefs.markerWidth,
      markerOpacity: prefs.markerOpacity,
      eraserWidth: prefs.eraserWidth,
    },
  });

  useFocusTrap(rootRef, open);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadDoodleDraft(conversationId, userId).then((row) => {
      if (!active) return;
      if (draftHasInk(row) && row) {
        setRestore(row.document);
        setAskRestore(true);
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [open, conversationId, userId]);

  useEffect(() => {
    if (!open || !ready) return;
    const timer = window.setTimeout(() => {
      void saveDoodleDraft({
        conversationId,
        userId,
        document: editor.document,
        tool: "pen",
        color: editor.prefs.color,
        penWidth: editor.prefs.penWidth,
        penOpacity: editor.prefs.penOpacity,
        markerWidth: editor.prefs.markerWidth,
        markerOpacity: editor.prefs.markerOpacity,
        eraserWidth: editor.prefs.eraserWidth,
        updatedAt: new Date().toISOString(),
      });
      saveToolPrefs({
        ...loadToolPrefs(),
        ...editor.prefs,
        color: editor.prefs.color,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open, ready, conversationId, userId, editor.document, editor.prefs]);

  const requestClose = useCallback(() => {
    if (editor.hasInk) {
      setAskDiscard(true);
      return;
    }
    void clearDoodleDraft(conversationId, userId);
    onClose();
  }, [conversationId, editor.hasInk, onClose, userId]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (askDiscard) {
          setAskDiscard(false);
          return;
        }
        if (askRestore) {
          setAskRestore(false);
          return;
        }
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (optionsOpen) {
          setOptionsOpen(false);
          return;
        }
        requestClose();
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askDiscard, askRestore, editor, open, optionsOpen, paletteOpen, requestClose]);

  function chooseTool(next: DoodleEditorTool) {
    if (next === editor.tool && next !== "eraser") {
      setOptionsOpen((value) => !value);
      setPaletteOpen(false);
      return;
    }
    editor.setTool(next);
    setOptionsOpen(next !== "eraser");
    setPaletteOpen(false);
  }

  function send() {
    if (!editor.hasInk) return;
    try {
      const payload = parseDoodleDocument(editor.document);
      void clearDoodleDraft(conversationId, userId);
      saveToolPrefs({
        ...loadToolPrefs(),
        ...editor.prefs,
        color: editor.prefs.color,
      });
      onSend(payload);
    } catch {
      // validation copy already shown via limit warning / empty send disabled
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Doodle"
      data-testid="doodle-editor"
      className="bg-background text-primary-text fixed inset-0 z-[80] flex flex-col items-center"
    >
      <div className="flex h-full w-full max-w-[28rem] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[calc(var(--shhh-safe-top)+0.7rem)] pb-2">
        <ShhhIconButton
          label="Close doodle"
          data-testid="doodle-close"
          className="bg-bg-soft size-11 shadow-none"
          onClick={requestClose}
        >
          <X className="size-5" strokeWidth={2.2} />
        </ShhhIconButton>
        <div className="flex items-center gap-1">
          <ShhhIconButton
            label="Undo"
            data-testid="doodle-undo"
            disabled={!editor.canUndo}
            className="bg-bg-soft size-11 shadow-none"
            onClick={editor.undo}
          >
            <Undo2 className="size-[1.15rem]" strokeWidth={2.1} />
          </ShhhIconButton>
          <ShhhIconButton
            label="Redo"
            data-testid="doodle-redo"
            disabled={!editor.canRedo}
            className="bg-bg-soft size-11 shadow-none"
            onClick={editor.redo}
          >
            <Redo2 className="size-[1.15rem]" strokeWidth={2.1} />
          </ShhhIconButton>
          <ShhhIconButton
            label="Clear doodle"
            data-testid="doodle-clear"
            disabled={!editor.hasInk}
            className="bg-bg-soft size-11 shadow-none"
            onClick={editor.clear}
          >
            <Trash2 className="size-[1.1rem]" strokeWidth={2.1} />
          </ShhhIconButton>
        </div>
        <ShhhButton
          type="button"
          data-testid="doodle-send"
          aria-label="Send doodle"
          disabled={!editor.hasInk}
          className="min-h-11 rounded-full px-5"
          onClick={send}
        >
          Send
        </ShhhButton>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <div
          className={cn(
            "shhh-doodle-paper shhh-doodle-paper-float relative w-full max-w-[22rem] overflow-hidden rounded-[1.85rem] sm:max-w-[24rem]",
            "aspect-[4/5] max-h-[min(72dvh,36rem)]",
          )}
        >
          <DoodleCanvas editor={editor} />
          {!editor.hasInk && !editor.drawing ? (
            <p
              data-testid="doodle-hint"
              className="pointer-events-none absolute inset-x-6 top-[42%] text-center text-sm font-medium text-[color-mix(in_srgb,var(--shhh-doodle-charcoal)_46%,transparent)]"
            >
              Draw something for {partnerName}
            </p>
          ) : null}
        </div>
      </div>

      {editor.limitWarning ? (
        <p data-testid="doodle-limit" className="text-warning px-4 pb-1 text-center text-xs font-medium">
          {editor.limitWarning}
        </p>
      ) : null}

      <div className="relative flex shrink-0 flex-col items-center px-3 pt-2 pb-[calc(var(--shhh-safe-bottom)+1.1rem)]">
        {optionsOpen && editor.tool !== "eraser" ? (
          <div className="absolute bottom-[calc(100%+0.55rem)]">
            <DoodleStrokeOptions
              tool={editor.tool}
              color={editor.color}
              width={editor.width}
              opacity={editor.opacity}
              onWidth={editor.setWidth}
              onOpacity={editor.setOpacity}
            />
          </div>
        ) : null}
        {paletteOpen ? (
          <div className="absolute bottom-[calc(100%+0.55rem)]">
            <DoodleColorPalette
              color={editor.color}
              recentColors={loadToolPrefs().recentColors}
              onSelect={(color) => {
                editor.setColor(color);
                saveToolPrefs(rememberRecentColor(loadToolPrefs(), color));
                setPaletteOpen(false);
              }}
            />
          </div>
        ) : null}
        <DoodleToolDock
          tool={editor.tool}
          color={editor.color}
          paletteOpen={paletteOpen}
          onTool={chooseTool}
          onColor={() => {
            setPaletteOpen((value) => !value);
            setOptionsOpen(false);
          }}
        />
      </div>
      </div>

      {askRestore || askDiscard ? (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-[color-mix(in_srgb,var(--shhh-overlay)_40%,transparent)] p-4 sm:items-center">
          <div
            className="bg-surface-floating w-full max-w-sm rounded-[1.75rem] px-5 py-5 shadow-[var(--shhh-shadow-float)]"
            data-testid={askRestore ? "doodle-restore" : "doodle-discard"}
          >
            <h2 className="text-primary-text text-lg font-bold">
              {askRestore ? "Continue your doodle?" : "Discard this doodle?"}
            </h2>
            <p className="text-secondary-text mt-2 text-sm">
              {askRestore
                ? "You had a drawing in progress."
                : "This drawing will be gone if you leave."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              {askRestore ? (
                <>
                  <ShhhButton
                    variant="ghost"
                    data-testid="doodle-restore-discard"
                    onClick={() => {
                      setAskRestore(false);
                      setRestore(null);
                      editor.replaceDocument(emptyDoodleDocument());
                      void clearDoodleDraft(conversationId, userId);
                    }}
                  >
                    Discard
                  </ShhhButton>
                  <ShhhButton
                    data-testid="doodle-restore-continue"
                    onClick={() => {
                      if (restore && documentHasInk(restore)) {
                        editor.replaceDocument(restore);
                      }
                      setAskRestore(false);
                    }}
                  >
                    Continue
                  </ShhhButton>
                </>
              ) : (
                <>
                  <ShhhButton
                    variant="ghost"
                    data-testid="doodle-discard-keep"
                    onClick={() => setAskDiscard(false)}
                  >
                    Keep drawing
                  </ShhhButton>
                  <ShhhButton
                    variant="danger"
                    data-testid="doodle-discard-confirm"
                    onClick={() => {
                      setAskDiscard(false);
                      void clearDoodleDraft(conversationId, userId);
                      editor.replaceDocument(emptyDoodleDocument());
                      onClose();
                    }}
                  >
                    Discard
                  </ShhhButton>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
